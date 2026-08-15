// =============================================================================
// C · INCIDENT ORCHESTRATOR
// -----------------------------------------------------------------------------
// Responsabilidade: consumir decisões da incident_queue (publicadas pelo Risk
// Worker) e transformá-las em incidentes com estado. Se já existe um incidente
// aberto para o mesmo contato/protegido, agrupa em vez de criar novo (antídoto
// a alert fatigue). A escada de entrega avança automaticamente se ninguém
// confirma dentro da janela de cada degrau.
// =============================================================================
import type { IncidentQueueMessage } from '@combinado/shared'
import type { Logger } from '../shared/logging/index.js'
import { orchestratorDb as db } from '../shared/db/roles.js'
import { queue } from '../shared/queue/index.js'
import type { QueueMessage } from '../shared/queue/types.js'
import { upsertIncident } from './incidents.js'
import { checkSuppression, recordProcessed } from './cooldown.js'
import { startLadder, tickLadder } from './ladder/index.js'

export interface OrchestratorHandle {
  stop(): Promise<void>
}

const POLL_INTERVAL_MS = 5_000
const BATCH_SIZE = 5
const VISIBILITY_SECONDS = 30
const MAX_RETRIES = 3

export async function startOrchestrator(log: Logger): Promise<OrchestratorHandle> {
  log.info('orchestrator online', { status: 'ready', role: 'incident_orchestrator' })

  let stopped = false
  let inflight: Promise<void> = Promise.resolve()

  async function processBatch(
    messages: QueueMessage<IncidentQueueMessage>[],
  ): Promise<void> {
    for (const msg of messages) {
      const body = msg.body
      const meta = {
        risk_event_id: body.risk_event_id,
        event_id: body.event_id,
        family_id: body.family_id,
        decision: body.decision,
        severity: body.severity,
        queue_msg_id: msg.msgId,
        read_count: msg.readCount,
      }

      try {
        // Cooldown e dedup antes de tocar no incidente
        const suppression = await checkSuppression(body, log)
        if (suppression.suppressed) {
          // Se cooldown (não dedup), ainda vincula o risk_event ao incidente
          // existente para manter a trilha de auditoria completa.
          if (suppression.reason === 'cooldown') {
            await linkRiskEventToOpenIncident(body, log)
          }
          await queue.ack('incident_queue', msg.msgId)
          log.info('incident_queue mensagem suprimida', {
            ...meta,
            reason: suppression.reason,
          })
          continue
        }

        const result = await upsertIncident(body, log)
        recordProcessed(body)

        if (result.created || result.reopened) {
          await startLadder(
            result.incident_id,
            body.protected_person_id,
            result.severity,
            log,
          )
        }

        await queue.ack('incident_queue', msg.msgId)

        log.info('incident_queue mensagem processada', {
          ...meta,
          incident_id: result.incident_id,
          created: result.created,
          reopened: result.reopened,
          ladder_started: result.created || result.reopened,
          final_severity: result.severity,
        })
      } catch (err) {
        log.error('falha ao processar incident_queue', {
          ...meta,
          error_name: (err as Error).name,
          error_detail: (err as Error).message?.slice(0, 200),
        })

        if (msg.readCount >= MAX_RETRIES) {
          log.warn('incident_queue mensagem enviada para DLQ', {
            risk_event_id: body.risk_event_id,
            read_count: msg.readCount,
          })
          try {
            await queue.deadletter('incident_queue', msg.msgId, body)
          } catch (dlqErr) {
            log.error('falha ao enviar para DLQ', {
              risk_event_id: body.risk_event_id,
              error_name: (dlqErr as Error).name,
            })
          }
        }
      }
    }
  }

  async function loop() {
    while (!stopped) {
      try {
        const messages = await queue.consume<IncidentQueueMessage>(
          'incident_queue',
          { visibilitySeconds: VISIBILITY_SECONDS, batchSize: BATCH_SIZE },
        )
        if (messages.length > 0) {
          log.debug('incident_queue batch', { count: messages.length })
          await processBatch(messages)
        }
      } catch (err) {
        log.error('erro no polling da incident_queue', {
          error_name: (err as Error).name,
        })
      }

      try {
        const escalated = await tickLadder(log)
        if (escalated > 0) {
          log.info('ladder tick: degraus avançados', { count: escalated })
        }
      } catch (err) {
        log.error('erro no tick da ladder', {
          error_name: (err as Error).name,
        })
      }

      if (stopped) return
      await sleep(POLL_INTERVAL_MS)
    }
  }

  inflight = loop()

  return {
    async stop() {
      log.info('orchestrator parando')
      stopped = true
      await inflight
    },
  }
}

async function linkRiskEventToOpenIncident(
  msg: IncidentQueueMessage,
  log: Logger,
): Promise<void> {
  const { data: incident } = await db
    .from('incidents')
    .select('id')
    .eq('family_id', msg.family_id)
    .eq('protected_person_id', msg.protected_person_id)
    .eq('source_contact', msg.sender_jid)
    .in('status', ['open', 'notifying', 'escalated'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (incident) {
    await db
      .from('risk_events')
      .update({ incident_id: incident.id })
      .eq('id', msg.risk_event_id)

    log.debug('cooldown: risk_event vinculado ao incidente existente', {
      risk_event_id: msg.risk_event_id,
      incident_id: incident.id,
    })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
