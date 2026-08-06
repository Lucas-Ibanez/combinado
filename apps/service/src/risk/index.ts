// =============================================================================
// B · RISK WORKER
// -----------------------------------------------------------------------------
// Responsabilidade: consumir eventos da risk_queue e rodar o pipeline
// determinístico → classificador → LLM (apoio) → política. Nunca vê chaves;
// nunca decide sozinho "é golpe confirmado".
//
// Neste bootstrap só temos o loop de polling da fila — a lógica de decisão
// entra a partir da F6. Poll vazio agora prova que o encanamento funciona.
// =============================================================================
import type { Logger } from '../shared/logging/index.js'
import { queue } from '../shared/queue/index.js'

export interface RiskHandle {
  stop(): Promise<void>
}

const POLL_INTERVAL_MS = 5_000

export async function startRisk(log: Logger): Promise<RiskHandle> {
  log.info('risk worker online', { status: 'ready', role: 'risk_worker' })

  let stopped = false
  let inflight: Promise<void> = Promise.resolve()

  async function loop() {
    while (!stopped) {
      try {
        const messages = await queue.consume('risk_queue', {
          visibilitySeconds: 30,
          batchSize: 5,
        })
        if (messages.length > 0) {
          log.debug('risk_queue tick', { batch: messages.length })
          // F6: aqui roda o pipeline. Por ora, devolve visibilidade (não ack)
          // para não perder eventos que porventura estejam na fila.
        }
      } catch (err) {
        log.error('erro no polling da risk_queue', {
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
      log.info('risk worker parando')
      stopped = true
      await inflight
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
