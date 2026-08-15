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
import type { MinimalEvent, IncidentQueueMessage } from '@combinado/shared'
import type { Logger } from '../shared/logging/index.js'
import { riskDb as db } from '../shared/db/roles.js'
import { queue } from '../shared/queue/index.js'
import type { QueueMessage } from '../shared/queue/types.js'
import { evaluateRules } from './rules/index.js'
import { classifier } from './classifier/index.js'
import { assessWithLlm } from './llm/index.js'
import { evaluatePolicy } from './policy/index.js'

const PIPELINE_VERSION = 'v1-rules+ws-classifier+nemotron-ultra+policy'

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

async function processEvent(event: MinimalEvent, log: Logger): Promise<void> {
  const t0 = performance.now()

  // Camada 1: regras determinísticas
  const ruleResult = evaluateRules(event)

  log.info('regras avaliadas', {
    event_id: event.event_id,
    wa_type: event.message_type,
    signals: event.signals,
    decision: ruleResult.decision,
    severity: ruleResult.severity,
    triggered_rules: ruleResult.triggered_rules,
    short_circuit: ruleResult.short_circuit,
    elapsed_ms: Math.round(performance.now() - t0),
  })

  // Camada 2: classificador estreito
  const classResult = classifier.classify(event)

  if (!ruleResult.short_circuit) {
    log.info('classificador avaliado', {
      event_id: event.event_id,
      score: classResult.score,
      classifier_version: classResult.version,
    })
  }

  // Camada 3: LLM como apoio (só se regras não fizeram short-circuit)
  let llmResult: Awaited<ReturnType<typeof assessWithLlm>>
  if (ruleResult.short_circuit) {
    llmResult = {
      assessment: null,
      used_fallback: true,
      model: 'skipped',
      prompt_version: 'skipped',
      latency_ms: 0,
      error: 'short_circuit',
    }
  } else {
    llmResult = await assessWithLlm(event, classResult.score, log)
    log.info('LLM avaliado', {
      event_id: event.event_id,
      used_fallback: llmResult.used_fallback,
      llm_model: llmResult.model,
      prompt_version: llmResult.prompt_version,
      latency_ms: llmResult.latency_ms,
      risk_assessment: llmResult.assessment?.risk_assessment ?? null,
      confidence: llmResult.assessment?.confidence ?? null,
      error: llmResult.error ?? null,
    })
  }

  // Camada 4: política determinística — a autoridade
  const policyResult = evaluatePolicy({
    rules: ruleResult,
    classifier: classResult,
    llm: llmResult,
  })

  log.info('política decidiu', {
    event_id: event.event_id,
    decision: policyResult.decision,
    severity: policyResult.severity,
    reasons: policyResult.reasons,
    elapsed_ms: Math.round(performance.now() - t0),
  })

  // Camada 5: gravar risk_event (sinais + decisão, NUNCA conteúdo bruto)
  const { data: riskEvent, error: insertErr } = await db
    .from('risk_events')
    .insert({
      family_id: event.family_id,
      protected_person_id: event.protected_person_id,
      signals: event.signals,
      severity: policyResult.severity,
      decision: policyResult.decision,
      pipeline_version: PIPELINE_VERSION,
    })
    .select('id, processed_at')
    .single()

  if (insertErr) {
    throw new Error(`risk_event insert falhou: ${insertErr.message}`)
  }

  log.info('risk_event gravado', {
    event_id: event.event_id,
    risk_event_id: riskEvent.id,
    decision: policyResult.decision,
    severity: policyResult.severity,
  })

  // Encaminhar ao Orchestrator se a decisão requer ação (review ou block)
  if (policyResult.decision !== 'allow') {
    const incidentMsg: IncidentQueueMessage = {
      risk_event_id: riskEvent.id,
      event_id: event.event_id,
      family_id: event.family_id,
      protected_person_id: event.protected_person_id,
      sender_jid: event.sender_jid,
      decision: policyResult.decision,
      severity: policyResult.severity,
      signals: event.signals,
      reasons: policyResult.reasons,
      processed_at: riskEvent.processed_at,
    }

    await queue.enqueue('incident_queue', incidentMsg)

    log.info('decisão encaminhada ao orchestrator', {
      event_id: event.event_id,
      risk_event_id: riskEvent.id,
      queue: 'incident_queue',
      decision: policyResult.decision,
      severity: policyResult.severity,
    })
  } else {
    log.info('decisão allow — sem encaminhamento', {
      event_id: event.event_id,
      risk_event_id: riskEvent.id,
    })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
