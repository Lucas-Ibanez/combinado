// =============================================================================
// C · INCIDENT ORCHESTRATOR
// -----------------------------------------------------------------------------
// Responsabilidade: consumir jobs da delivery_queue e executar a escada de
// entrega multicanal (push → WhatsApp/SMS → ligação → 2º guardião), com
// escalonamento por timeout e ack por ação humana confirmada.
//
// Neste bootstrap só temos o loop de polling — canais e escada entram na F9.
// =============================================================================
import type { Logger } from '../shared/logging/index.js'
import { queue } from '../shared/queue/index.js'

export interface OrchestratorHandle {
  stop(): Promise<void>
}

const POLL_INTERVAL_MS = 5_000

export async function startOrchestrator(log: Logger): Promise<OrchestratorHandle> {
  log.info('orchestrator online', { status: 'ready', role: 'incident_orchestrator' })

  let stopped = false
  let inflight: Promise<void> = Promise.resolve()

  async function loop() {
    while (!stopped) {
      try {
        const messages = await queue.consume('delivery_queue', {
          visibilitySeconds: 30,
          batchSize: 5,
        })
        if (messages.length > 0) {
          log.debug('delivery_queue tick', { batch: messages.length })
          // F9: aqui entra a escada de entrega (canais + escalonamento).
        }
      } catch (err) {
        log.error('erro no polling da delivery_queue', {
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
