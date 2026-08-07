import { queue } from '../../shared/queue/index.js'
import type { Logger } from '../../shared/logging/index.js'
import type { PairingManager } from './manager.js'

// Loop de consumo do command_outbox — filtra jobs do tipo pair_device e
// delega ao PairingManager. Outros tipos (start_simulation, etc.) ficarão
// para as fases que os introduzem; por ora só damos ack pra não vazar.
const POLL_INTERVAL_MS = 5_000
const VISIBILITY_SECONDS = 30

interface PairDeviceJob {
  type: 'pair_device'
  protected_person_id: string
  guardian_id?: string
  family_id?: string
  idempotency_key?: string | null
}

function isPairDeviceJob(body: unknown): body is PairDeviceJob {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { type?: unknown }).type === 'pair_device' &&
    typeof (body as { protected_person_id?: unknown }).protected_person_id === 'string'
  )
}

export interface OutboxLoopHandle {
  stop(): Promise<void>
}

export function startOutboxLoop(manager: PairingManager, log: Logger): OutboxLoopHandle {
  let stopped = false
  let running: Promise<void> = Promise.resolve()

  async function tick() {
    while (!stopped) {
      try {
        const messages = await queue.consume<Record<string, unknown>>('command_outbox', {
          visibilitySeconds: VISIBILITY_SECONDS,
          batchSize: 5,
        })
        for (const msg of messages) {
          if (isPairDeviceJob(msg.body)) {
            log.info('job pair_device recebido', {
              msg_id: msg.msgId,
              protected_person_id: msg.body.protected_person_id,
            })
            try {
              await manager.open(msg.body.protected_person_id)
              await queue.ack('command_outbox', msg.msgId)
            } catch (err) {
              log.error('falha ao processar pair_device', {
                msg_id: msg.msgId,
                error_name: (err as Error).name,
              })
              // Não damos ack — deixamos a mensagem voltar a ficar visível
              // após o visibility timeout; se falhar de novo, DLQ vem em F13.
            }
          } else {
            // Outros tipos de job ainda não são responsabilidade do gateway;
            // devolve visibilidade para outro consumidor (futuro).
            log.debug('job ignorado no gateway', {
              msg_id: msg.msgId,
              type: (msg.body as { type?: unknown })?.type ?? null,
            })
          }
        }
      } catch (err) {
        log.error('erro no polling do command_outbox', {
          error_name: (err as Error).name,
        })
      }
      if (stopped) return
      await sleep(POLL_INTERVAL_MS)
    }
  }

  running = tick()

  return {
    async stop() {
      stopped = true
      await running
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
