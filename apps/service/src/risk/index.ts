// =============================================================================
// B · RISK WORKER
// -----------------------------------------------------------------------------
// Responsabilidade: consumir eventos da risk_queue e rodar o pipeline
// determinístico → classificador → LLM (apoio) → política. Nunca vê chaves;
// nunca decide sozinho "é golpe confirmado".
//
// O loop consome em batch, processa cada evento de forma idempotente (event_id
// do WhatsApp é o identificador natural) e faz ack individual. Se o
// processamento falhar e a mensagem já foi lida mais de MAX_RETRIES vezes,
// vai para a DLQ em vez de travar a fila.
// =============================================================================
import type { MinimalEvent } from '@combinado/shared'
import type { Logger } from '../shared/logging/index.js'
import { queue } from '../shared/queue/index.js'
import type { QueueMessage } from '../shared/queue/types.js'
import { evaluateRules } from './rules/index.js'

export interface RiskHandle {
  stop(): Promise<void>
}

const POLL_INTERVAL_MS = 5_000
const BATCH_SIZE = 5
const VISIBILITY_SECONDS = 30
const MAX_RETRIES = 3

export async function startRisk(log: Logger): Promise<RiskHandle> {
  log.info('risk worker online', { status: 'ready', role: 'risk_worker' })

  let stopped = false
  let inflight: Promise<void> = Promise.resolve()

  async function processBatch(messages: QueueMessage<MinimalEvent>[]): Promise<void> {
    for (const msg of messages) {
      const event = msg.body
      const eventMeta = {
        event_id: event.event_id,
        family_id: event.family_id,
        protected_person_id: event.protected_person_id,
        wa_type: event.message_type,
        signals: event.signals,
        char_count: event.text_length,
        queue_msg_id: msg.msgId,
        read_count: msg.readCount,
      }

      try {
        await processEvent(event, log)

        await queue.ack('risk_queue', msg.msgId)
        log.info('evento processado e confirmado', eventMeta)
      } catch (err) {
        log.error('falha ao processar evento', {
          ...eventMeta,
          error_name: (err as Error).name,
        })

        if (msg.readCount >= MAX_RETRIES) {
          log.warn('evento enviado para DLQ após retries esgotados', {
            event_id: event.event_id,
            read_count: msg.readCount,
          })
          try {
            await queue.deadletter('risk_queue', msg.msgId, event)
          } catch (dlqErr) {
            log.error('falha ao enviar para DLQ', {
              event_id: event.event_id,
              error_name: (dlqErr as Error).name,
            })
          }
        }
        // Se readCount < MAX_RETRIES, não faz ack — a mensagem volta à fila
        // após o visibilitySeconds expirar, e será reprocessada.
      }
    }
  }

  async function loop() {
    while (!stopped) {
      try {
        const messages = await queue.consume<MinimalEvent>('risk_queue', {
          visibilitySeconds: VISIBILITY_SECONDS,
          batchSize: BATCH_SIZE,
        })
        if (messages.length > 0) {
          log.debug('risk_queue batch', { count: messages.length })
          await processBatch(messages)
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

// Pipeline de risco — camadas sequenciais.
// Camada 1 (regras) pode short-circuit: se o caso é óbvio, não precisa do
// classificador nem do LLM. Camadas 2-4 entram em T6.3→T6.5.
async function processEvent(event: MinimalEvent, log: Logger): Promise<void> {
  const t0 = performance.now()

  // Camada 1: regras determinísticas
  const ruleResult = evaluateRules(event)
  const elapsed = Math.round(performance.now() - t0)

  log.info('regras avaliadas', {
    event_id: event.event_id,
    wa_type: event.message_type,
    signals: event.signals,
    decision: ruleResult.decision,
    severity: ruleResult.severity,
    triggered_rules: ruleResult.triggered_rules,
    short_circuit: ruleResult.short_circuit,
    elapsed_ms: elapsed,
  })

  if (ruleResult.short_circuit) {
    // Caso óbvio — a regra já decidiu. O LLM pode enriquecer a explicação
    // depois, mas a ação sai agora.
    log.info('short-circuit: regras decidiram sem LLM', {
      event_id: event.event_id,
      decision: ruleResult.decision,
      severity: ruleResult.severity,
    })
    // T6.5 (política) e T7 (orchestrator) consomem o resultado daqui.
    return
  }

  // T6.3: classificador estreito (score heurístico)
  // T6.4: LLM como apoio (só ambíguos)
  // T6.5: política determinística final
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
