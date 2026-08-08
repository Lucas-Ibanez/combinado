// =============================================================================
// C · INCIDENT ORCHESTRATOR
// -----------------------------------------------------------------------------
// Responsabilidade: consumir decisões da incident_queue (publicadas pelo Risk
// Worker) e transformá-las em incidentes com estado. Se já existe um incidente
// aberto para o mesmo contato/protegido, agrupa em vez de criar novo (antídoto
// a alert fatigue). A escada de entrega multicanal entra na F9.
// =============================================================================
import type { IncidentQueueMessage } from '@combinado/shared'
import type { Logger } from '../shared/logging/index.js'
import { queue } from '../shared/queue/index.js'
import type { QueueMessage } from '../shared/queue/types.js'
import { upsertIncident } from './incidents.js'

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
        const result = await upsertIncident(body, log)

        await queue.ack('incident_queue', msg.msgId)

        log.info('incident_queue mensagem processada', {
          ...meta,
          incident_id: result.incident_id,
          created: result.created,
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
