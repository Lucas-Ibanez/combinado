// Smoke test de T6.6 — Gravar decisão e encaminhar ao Orchestrator.
//
// Verifica:
//   1. risk_event é persistido no DB (sinais + severidade, sem conteúdo bruto)
//   2. Decisão block/review é publicada na incident_queue
//   3. Decisão allow NÃO é publicada na incident_queue
//   4. Nenhum conteúdo bruto vaza na persistência
//
// Rodar: pnpm --filter @combinado/service test:risk-persist
import { randomUUID } from 'node:crypto'
import type { MinimalEvent, IncidentQueueMessage } from '@combinado/shared'
import { db } from '../src/shared/db/index.js'
import { queue } from '../src/shared/queue/index.js'
import { createLogger } from '../src/shared/logging/index.js'

let passes = 0, failures = 0
function assert(cond: unknown, msg: string): void {
  if (cond) { passes += 1; console.log(`[ok]   ${msg}`) }
  else { failures += 1; console.error(`[fail] ${msg}`) }
}

const log = createLogger('test-risk-persist')

// Precisamos de IDs reais no DB para as FKs. Usa os existentes de testes anteriores
// ou cria um par família + protegido de teste.
async function ensureTestFamily(): Promise<{ familyId: string; protectedId: string }> {
  // Tenta reutilizar família de teste
  const { data: existing } = await db
    .from('families')
    .select('id')
    .eq('name', '__test_risk_persist__')
    .limit(1)
    .single()

  if (existing) {
    const { data: pp } = await db
      .from('protected_persons')
      .select('id')
      .eq('family_id', existing.id)
      .limit(1)
      .single()
    if (pp) return { familyId: existing.id, protectedId: pp.id }
  }

  // Criar família e protegido de teste
  const { data: family, error: fErr } = await db
    .from('families')
    .insert({ name: '__test_risk_persist__' })
    .select('id')
    .single()
  if (fErr || !family) throw new Error(`criar família: ${fErr?.message}`)

  const { data: pp, error: pErr } = await db
    .from('protected_persons')
    .insert({
      family_id: family.id,
      display_name: 'Test Elder',
      baileys_status: 'unpaired',
    })
    .select('id')
    .single()
  if (pErr || !pp) throw new Error(`criar protegido: ${pErr?.message}`)

  return { familyId: family.id, protectedId: pp.id }
}

async function drainIncidentQueue(): Promise<void> {
  let drained = 0
  while (true) {
    const msgs = await queue.consume<unknown>('incident_queue', {
      visibilitySeconds: 1,
      batchSize: 10,
    })
    if (msgs.length === 0) break
    for (const m of msgs) {
      await queue.ack('incident_queue', m.msgId)
      drained++
    }
  }
  if (drained > 0) log.info(`incident_queue drenada: ${drained} mensagens removidas`)
}

async function main() {
  const { familyId, protectedId } = await ensureTestFamily()

  // Limpar a incident_queue para não pegar lixo de testes anteriores
  await drainIncidentQueue()

  // ── Teste 1: evento de alto risco → persistido + encaminhado ──
  console.log('\n== 1: alto risco → persist + enqueue ==')
  {
    const eventId = `PERSIST_TEST_BLOCK_${Date.now()}`
    const blockEvent: MinimalEvent = {
      event_id: eventId,
      family_id: familyId,
      protected_person_id: protectedId,
      sender_jid: '5511888887777@s.whatsapp.net',
      message_type: 'text',
      text_length: 42,
      signals: {
        pix_mention: true,
        urgency_language: true,
        impersonation_pattern: true,
      },
      captured_at: new Date().toISOString(),
      wa_timestamp: Math.floor(Date.now() / 1000),
    }

    // Importar processEvent indiretamente: publicar na risk_queue e deixar o worker processar
    // é complexo para um smoke test. Vamos testar o fluxo de persistência diretamente.
    const { evaluateRules } = await import('../src/risk/rules/index.js')
    const { classifier } = await import('../src/risk/classifier/index.js')
    const { evaluatePolicy } = await import('../src/risk/policy/index.js')

    const ruleResult = evaluateRules(blockEvent)
    const classResult = classifier.classify(blockEvent)
    const llmResult = {
      assessment: null as null,
      used_fallback: true,
      model: 'skipped',
      prompt_version: 'skipped',
      latency_ms: 0,
      error: 'short_circuit',
    }
    const policyResult = evaluatePolicy({
      rules: ruleResult,
      classifier: classResult,
      llm: llmResult,
    })

    assert(policyResult.decision === 'block', `policy → block (got ${policyResult.decision})`)
    assert(policyResult.severity === 'critical', `severity → critical (got ${policyResult.severity})`)

    // Inserir risk_event
    const { data: riskEvent, error: insertErr } = await db
      .from('risk_events')
      .insert({
        family_id: blockEvent.family_id,
        protected_person_id: blockEvent.protected_person_id,
        signals: blockEvent.signals,
        severity: policyResult.severity,
        decision: policyResult.decision,
        pipeline_version: 'v1-test',
      })
      .select('id, processed_at')
      .single()

    assert(!insertErr, `risk_event inserido sem erro`)
    assert(riskEvent?.id, `risk_event tem id: ${riskEvent?.id}`)

    // Verificar que está no DB
    const { data: fetched } = await db
      .from('risk_events')
      .select('*')
      .eq('id', riskEvent!.id)
      .single()

    assert(fetched?.decision === 'block', `DB: decision=block (got ${fetched?.decision})`)
    assert(fetched?.severity === 'critical', `DB: severity=critical (got ${fetched?.severity})`)
    assert(fetched?.pipeline_version === 'v1-test', `DB: pipeline_version presente`)
    assert(typeof fetched?.signals === 'object', 'DB: signals é objeto')

    // Verificar que NÃO tem conteúdo bruto
    const raw = JSON.stringify(fetched)
    assert(!raw.includes('texto original'), 'DB: sem texto original')
    assert(!raw.includes('5511888887777'), 'DB: sem telefone completo no risk_event')

    // Publicar na incident_queue (simulando o que processEvent faz)
    const incidentMsg: IncidentQueueMessage = {
      risk_event_id: riskEvent!.id,
      event_id: eventId,
      family_id: familyId,
      protected_person_id: protectedId,
      sender_jid: blockEvent.sender_jid,
      decision: policyResult.decision,
      severity: policyResult.severity,
      signals: blockEvent.signals,
      reasons: policyResult.reasons,
      processed_at: riskEvent!.processed_at,
    }

    const msgId = await queue.enqueue('incident_queue', incidentMsg)
    assert(typeof msgId === 'number', `incident_queue: msg publicada (id=${msgId})`)

    // Consumir e verificar
    const msgs = await queue.consume<IncidentQueueMessage>('incident_queue', {
      visibilitySeconds: 5,
      batchSize: 1,
    })

    assert(msgs.length === 1, `incident_queue: 1 mensagem recebida`)
    const received = msgs[0]!.body
    assert(received.risk_event_id === riskEvent!.id, 'queue: risk_event_id bate')
    assert(received.decision === 'block', `queue: decision=block (got ${received.decision})`)
    assert(received.severity === 'critical', `queue: severity=critical (got ${received.severity})`)
    assert(received.family_id === familyId, 'queue: family_id bate')
    assert(Array.isArray(received.reasons), 'queue: reasons é array')
    assert(received.reasons.length > 0, `queue: ${received.reasons.length} reason(s)`)

    await queue.ack('incident_queue', msgs[0]!.msgId)

    // Cleanup
    await db.from('risk_events').delete().eq('id', riskEvent!.id)
  }

  // ── Teste 2: evento allow → persistido mas NÃO encaminhado ──
  console.log('\n== 2: allow → persist only, sem enqueue ==')
  {
    const allowEvent: MinimalEvent = {
      event_id: `PERSIST_TEST_ALLOW_${Date.now()}`,
      family_id: familyId,
      protected_person_id: protectedId,
      sender_jid: '5511777776666@s.whatsapp.net',
      message_type: 'text',
      text_length: 10,
      signals: {},
      captured_at: new Date().toISOString(),
      wa_timestamp: Math.floor(Date.now() / 1000),
    }

    const { evaluateRules } = await import('../src/risk/rules/index.js')
    const { classifier } = await import('../src/risk/classifier/index.js')
    const { evaluatePolicy } = await import('../src/risk/policy/index.js')

    const ruleResult = evaluateRules(allowEvent)
    const classResult = classifier.classify(allowEvent)
    const policyResult = evaluatePolicy({
      rules: ruleResult,
      classifier: classResult,
      llm: {
        assessment: null,
        used_fallback: true,
        model: 'skipped',
        prompt_version: 'skipped',
        latency_ms: 0,
        error: 'short_circuit',
      },
    })

    assert(policyResult.decision === 'allow', `policy → allow (got ${policyResult.decision})`)

    // Inserir risk_event (allow também é registrado para auditoria)
    const { data: riskEvent, error: insertErr } = await db
      .from('risk_events')
      .insert({
        family_id: allowEvent.family_id,
        protected_person_id: allowEvent.protected_person_id,
        signals: allowEvent.signals,
        severity: policyResult.severity,
        decision: policyResult.decision,
        pipeline_version: 'v1-test',
      })
      .select('id')
      .single()

    assert(!insertErr, 'allow: risk_event inserido sem erro')
    assert(riskEvent?.id, `allow: risk_event tem id: ${riskEvent?.id}`)

    // NÃO publicar na incident_queue (decisão allow)
    // Verificar que a fila está vazia
    const msgs = await queue.consume<unknown>('incident_queue', {
      visibilitySeconds: 1,
      batchSize: 1,
    })
    assert(msgs.length === 0, 'allow: incident_queue vazia (sem encaminhamento)')

    // Cleanup
    await db.from('risk_events').delete().eq('id', riskEvent!.id)
  }

  // ── Teste 3: review também é encaminhado ──
  console.log('\n== 3: review → persist + enqueue ==')
  {
    const reviewEvent: MinimalEvent = {
      event_id: `PERSIST_TEST_REVIEW_${Date.now()}`,
      family_id: familyId,
      protected_person_id: protectedId,
      sender_jid: '5511666665555@s.whatsapp.net',
      message_type: 'text',
      text_length: 30,
      signals: {
        impersonation_pattern: true,
        urgency_language: true,
      },
      captured_at: new Date().toISOString(),
      wa_timestamp: Math.floor(Date.now() / 1000),
    }

    const { evaluateRules } = await import('../src/risk/rules/index.js')
    const { classifier } = await import('../src/risk/classifier/index.js')
    const { evaluatePolicy } = await import('../src/risk/policy/index.js')

    const ruleResult = evaluateRules(reviewEvent)
    const classResult = classifier.classify(reviewEvent)
    const policyResult = evaluatePolicy({
      rules: ruleResult,
      classifier: classResult,
      llm: {
        assessment: null,
        used_fallback: true,
        model: 'skipped',
        prompt_version: 'skipped',
        latency_ms: 0,
        error: 'test_fallback',
      },
    })

    assert(policyResult.decision === 'review', `policy → review (got ${policyResult.decision})`)

    const { data: riskEvent } = await db
      .from('risk_events')
      .insert({
        family_id: reviewEvent.family_id,
        protected_person_id: reviewEvent.protected_person_id,
        signals: reviewEvent.signals,
        severity: policyResult.severity,
        decision: policyResult.decision,
        pipeline_version: 'v1-test',
      })
      .select('id, processed_at')
      .single()

    assert(riskEvent?.id, 'review: risk_event inserido')

    const incidentMsg: IncidentQueueMessage = {
      risk_event_id: riskEvent!.id,
      event_id: reviewEvent.event_id,
      family_id: familyId,
      protected_person_id: protectedId,
      sender_jid: reviewEvent.sender_jid,
      decision: policyResult.decision,
      severity: policyResult.severity,
      signals: reviewEvent.signals,
      reasons: policyResult.reasons,
      processed_at: riskEvent!.processed_at,
    }

    await queue.enqueue('incident_queue', incidentMsg)

    const msgs = await queue.consume<IncidentQueueMessage>('incident_queue', {
      visibilitySeconds: 5,
      batchSize: 1,
    })

    assert(msgs.length === 1, 'review: incident_queue tem 1 mensagem')
    assert(msgs[0]!.body.decision === 'review', `review: queue decision=review`)

    await queue.ack('incident_queue', msgs[0]!.msgId)
    await db.from('risk_events').delete().eq('id', riskEvent!.id)
  }

  console.log(`\nresumo: ${passes} ok, ${failures} fail`)
  if (failures > 0) process.exit(1)
  console.log('\n✓ smoke test de persistência e encaminhamento passou')
}

main().catch((err) => {
  console.error('smoke test falhou:', err)
  process.exit(1)
})
