import type { Logger } from '../shared/logging/index.js'
import { queue } from '../shared/queue/index.js'
import { simulationDb as db } from '../shared/db/roles.js'
import type { OfficialSessionHandle } from '../orchestrator/channels/official-session.js'
import { buildSimulationMessage } from './messages.js'

export interface SimulationWorkerHandle {
  stop(): Promise<void>
}

const POLL_INTERVAL_MS = 5_000
const VISIBILITY_SECONDS = 30
const MAX_RETRIES = 3

interface StartSimulationJob {
  type: 'start_simulation'
  simulation_id: string
  family_id: string
  protected_person_id: string
  guardian_id: string
  idempotency_key?: string | null
}

function isSimulationJob(body: unknown): body is StartSimulationJob {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { type?: unknown }).type === 'start_simulation' &&
    typeof (body as { simulation_id?: unknown }).simulation_id === 'string'
  )
}

function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs))
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function startSimulationWorker(
  officialSession: OfficialSessionHandle,
  log: Logger,
): Promise<SimulationWorkerHandle> {
  log.info('simulation-worker online', { status: 'ready' })

  let stopped = false
  let inflight: Promise<void> = Promise.resolve()

  async function processJob(job: StartSimulationJob): Promise<void> {
    const { data: sim } = await db
      .from('simulations')
      .select('status')
      .eq('id', job.simulation_id)
      .single()

    if (!sim || sim.status !== 'scheduled') {
      log.debug('simulation: já processada ou inexistente', {
        simulation_id: job.simulation_id,
        current_status: sim?.status ?? 'not_found',
      })
      return
    }

    const { data: pp } = await db
      .from('protected_persons')
      .select('phone, display_name')
      .eq('id', job.protected_person_id)
      .single()

    if (!pp?.phone) {
      log.warn('simulation: protegido sem telefone', {
        simulation_id: job.simulation_id,
        protected_person_id: job.protected_person_id,
      })
      return
    }

    const sock = officialSession.socket()
    if (!sock) {
      log.warn('simulation: sessão oficial desconectada, aguardando retry', {
        simulation_id: job.simulation_id,
        health: officialSession.health(),
      })
      throw new Error('official_session_disconnected')
    }

    const jid = phoneToJid(pp.phone)
    const text = buildSimulationMessage(pp.display_name)

    await randomDelay(2_000, 5_000)

    const result = await sock.sendMessage(jid, { text })
    const messageId = result?.key?.id ?? null

    await db
      .from('simulations')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', job.simulation_id)

    log.info('simulation: mensagem enviada ao protegido', {
      simulation_id: job.simulation_id,
      message_id: messageId,
    })
  }

  async function loop() {
    while (!stopped) {
      try {
        const messages = await queue.consume<Record<string, unknown>>('command_outbox', {
          visibilitySeconds: VISIBILITY_SECONDS,
          batchSize: 5,
        })

        for (const msg of messages) {
          if (!isSimulationJob(msg.body)) continue

          const meta = {
            simulation_id: msg.body.simulation_id,
            queue_msg_id: msg.msgId,
            read_count: msg.readCount,
          }

          try {
            await processJob(msg.body)
            await queue.ack('command_outbox', msg.msgId)
            log.info('simulation: job processado', meta)
          } catch (err) {
            log.error('simulation: falha ao processar job', {
              ...meta,
              error_name: (err as Error).name,
            })
            if (msg.readCount >= MAX_RETRIES) {
              try {
                await queue.deadletter('command_outbox', msg.msgId, msg.body)
                log.warn('simulation: job enviado para DLQ', meta)
              } catch (dlqErr) {
                log.error('simulation: falha ao enviar para DLQ', {
                  ...meta,
                  error_name: (dlqErr as Error).name,
                })
              }
            }
          }
        }
      } catch (err) {
        log.error('simulation: erro no polling', {
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
      log.info('simulation-worker parando')
      stopped = true
      await inflight
    },
  }
}

export { evaluateResponse } from './messages.js'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
