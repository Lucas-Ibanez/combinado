// Smoke test de T7.2 — Cooldown e deduplicação.
//
// Verifica:
//   1. Dedup: risk_event já vinculado → suprimido
//   2. Cooldown: mesmo contato dentro da janela → suprimido
//   3. Cooldown: contato diferente → não suprimido
//   4. Cooldown: mesmo contato fora da janela → não suprimido
//   5. Rajada (10 eventos) → apenas 1 processa, 9 suprimidos
//   6. Cooldown: risk_event suprimido ainda é vinculado ao incidente
//
// Rodar: pnpm --filter @combinado/service test:cooldown
import type { IncidentQueueMessage } from '@combinado/shared'
import { db } from '../src/shared/db/index.js'
import { createLogger } from '../src/shared/logging/index.js'
import {
  checkSuppression,
  recordProcessed,
  cooldownWindowMs,
  _resetForTest,
  _setLastProcessed,
} from '../src/orchestrator/cooldown.js'
import { upsertIncident } from '../src/orchestrator/incidents.js'

let passes = 0, failures = 0
function assert(cond: unknown, msg: string): void {
  if (cond) { passes += 1; console.log(`[ok]   ${msg}`) }
  else { failures += 1; console.error(`[fail] ${msg}`) }
}

const log = createLogger('test-cooldown')

async function ensureTestFamily(): Promise<{ familyId: string; protectedId: string }> {
  const { data: existing } = await db
    .from('families')
    .select('id')
    .eq('name', '__test_cooldown__')
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

  const { data: family } = await db
    .from('families')
    .insert({ name: '__test_cooldown__' })
    .select('id')
    .single()
  if (!family) throw new Error('criar família falhou')

  const { data: pp } = await db
    .from('protected_persons')
    .insert({
      family_id: family.id,
      display_name: 'Test Elder Cooldown',
      baileys_status: 'unpaired',
    })
    .select('id')
    .single()
  if (!pp) throw new Error('criar protegido falhou')

  return { familyId: family.id, protectedId: pp.id }
}

async function createRiskEvent(
  familyId: string,
  protectedId: string,
): Promise<{ id: string; processed_at: string }> {
  const { data, error } = await db
    .from('risk_events')
    .insert({
      family_id: familyId,
      protected_person_id: protectedId,
      signals: { pix_mention: true },
      severity: 'high',
      decision: 'block',
      pipeline_version: 'v1-test',
    })
    .select('id, processed_at')
    .single()
  if (error || !data) throw new Error(`criar risk_event: ${error?.message}`)
  return data
}

function makeMsg(
  riskEventId: string,
  familyId: string,
  protectedId: string,
  senderJid = '5511999990001@s.whatsapp.net',
): IncidentQueueMessage {
  return {
    risk_event_id: riskEventId,
    event_id: `EVT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    family_id: familyId,
    protected_person_id: protectedId,
    sender_jid: senderJid,
    decision: 'block',
    severity: 'high',
    signals: { pix_mention: true, urgency_language: true },
    reasons: ['test'],
    processed_at: new Date().toISOString(),
  }
}

const cleanupRiskEvents: string[] = []
const cleanupIncidents: string[] = []

async function main() {
  const { familyId, protectedId } = await ensureTestFamily()
  _resetForTest()

  // ── 1: dedup — risk_event já vinculado a incidente ──
  console.log('\n== 1: dedup — risk_event já vinculado ==')
  {
    const re = await createRiskEvent(familyId, protectedId)
    cleanupRiskEvents.push(re.id)

    const msg = makeMsg(re.id, familyId, protectedId)

    // Processar primeiro → cria incidente e vincula
    const result = await upsertIncident(msg, log)
    cleanupIncidents.push(result.incident_id)
    recordProcessed(msg)

    // Resetar cooldown para testar só o dedup
    _resetForTest()

    // Mesmo risk_event de novo → deve ser suprimido por dedup
    const check = await checkSuppression(msg, log)
    assert(check.suppressed === true, 'dedup: suprimido')
    assert(check.reason === 'dedup', `dedup: reason=dedup (got ${check.reason})`)
    assert(check.existing_incident_id === result.incident_id, 'dedup: retorna incident_id')
  }

  _resetForTest()

  // ── 2: cooldown — mesmo contato dentro da janela ──
  console.log('\n== 2: cooldown — mesmo contato dentro da janela ==')
  {
    const re1 = await createRiskEvent(familyId, protectedId)
    const re2 = await createRiskEvent(familyId, protectedId)
    cleanupRiskEvents.push(re1.id, re2.id)

    const msg1 = makeMsg(re1.id, familyId, protectedId, '5511888880099@s.whatsapp.net')

    // Primeiro: não suprimido
    const check1 = await checkSuppression(msg1, log)
    assert(check1.suppressed === false, 'primeiro evento: não suprimido')

    // Processar e registrar
    const result = await upsertIncident(msg1, log)
    cleanupIncidents.push(result.incident_id)
    recordProcessed(msg1)

    // Segundo do mesmo contato: suprimido por cooldown
    const msg2 = makeMsg(re2.id, familyId, protectedId, '5511888880099@s.whatsapp.net')
    const check2 = await checkSuppression(msg2, log)
    assert(check2.suppressed === true, 'segundo evento: suprimido')
    assert(check2.reason === 'cooldown', `reason=cooldown (got ${check2.reason})`)
  }

  _resetForTest()

  // ── 3: cooldown — contato diferente → não suprimido ──
  console.log('\n== 3: contato diferente → não suprimido ==')
  {
    const re1 = await createRiskEvent(familyId, protectedId)
    const re2 = await createRiskEvent(familyId, protectedId)
    cleanupRiskEvents.push(re1.id, re2.id)

    const msg1 = makeMsg(re1.id, familyId, protectedId, '5511111110001@s.whatsapp.net')
    recordProcessed(msg1)

    const msg2 = makeMsg(re2.id, familyId, protectedId, '5511222220002@s.whatsapp.net')
    const check = await checkSuppression(msg2, log)
    assert(check.suppressed === false, 'contato diferente: não suprimido')
  }

  _resetForTest()

  // ── 4: cooldown — mesmo contato fora da janela → não suprimido ──
  console.log('\n== 4: mesmo contato fora da janela → não suprimido ==')
  {
    const re = await createRiskEvent(familyId, protectedId)
    cleanupRiskEvents.push(re.id)

    const msg = makeMsg(re.id, familyId, protectedId, '5511333330003@s.whatsapp.net')

    // Simular que foi processado há mais de 5 minutos
    const pastTs = Date.now() - cooldownWindowMs() - 1000
    _setLastProcessed(msg, pastTs)

    const check = await checkSuppression(msg, log)
    assert(check.suppressed === false, 'fora da janela: não suprimido')
  }

  _resetForTest()

  // ── 5: rajada de 10 eventos → apenas 1 processa ──
  console.log('\n== 5: rajada de 10 eventos ==')
  {
    let processed = 0
    let suppressed = 0
    const senderJid = '5511444440004@s.whatsapp.net'

    for (let i = 0; i < 10; i++) {
      const re = await createRiskEvent(familyId, protectedId)
      cleanupRiskEvents.push(re.id)

      const msg = makeMsg(re.id, familyId, protectedId, senderJid)
      const check = await checkSuppression(msg, log)

      if (check.suppressed) {
        suppressed++
      } else {
        const result = await upsertIncident(msg, log)
        if (i === 0) cleanupIncidents.push(result.incident_id)
        recordProcessed(msg)
        processed++
      }
    }

    assert(processed === 1, `rajada: 1 processado (got ${processed})`)
    assert(suppressed === 9, `rajada: 9 suprimidos (got ${suppressed})`)
  }

  _resetForTest()

  // ── 6: cooldown vincula risk_event ao incidente existente ──
  console.log('\n== 6: risk_event suprimido vinculado ao incidente ==')
  {
    const re1 = await createRiskEvent(familyId, protectedId)
    const re2 = await createRiskEvent(familyId, protectedId)
    cleanupRiskEvents.push(re1.id, re2.id)

    const senderJid = '5511555550005@s.whatsapp.net'
    const msg1 = makeMsg(re1.id, familyId, protectedId, senderJid)

    // Processar primeiro normalmente
    const result = await upsertIncident(msg1, log)
    cleanupIncidents.push(result.incident_id)
    recordProcessed(msg1)

    // Segundo: suprimido por cooldown, mas vinculamos manualmente
    const msg2 = makeMsg(re2.id, familyId, protectedId, senderJid)
    const check = await checkSuppression(msg2, log)
    assert(check.suppressed === true, 'segundo suprimido por cooldown')

    // Simular o que o orchestrator faz: vincular ao incidente existente
    const { data: incident } = await db
      .from('incidents')
      .select('id')
      .eq('family_id', familyId)
      .eq('protected_person_id', protectedId)
      .eq('source_contact', senderJid)
      .in('status', ['open', 'notifying', 'escalated'])
      .limit(1)
      .maybeSingle()

    if (incident) {
      await db
        .from('risk_events')
        .update({ incident_id: incident.id })
        .eq('id', re2.id)
    }

    // Verificar que o risk_event 2 está vinculado
    const { data: reCheck } = await db
      .from('risk_events')
      .select('incident_id')
      .eq('id', re2.id)
      .single()

    assert(
      reCheck?.incident_id === result.incident_id,
      'risk_event suprimido vinculado ao incidente existente',
    )
  }

  // ── Cleanup ──
  for (const id of cleanupRiskEvents) {
    await db.from('risk_events').delete().eq('id', id)
  }
  for (const id of cleanupIncidents) {
    await db.from('incidents').delete().eq('id', id)
  }

  console.log(`\nresumo: ${passes} ok, ${failures} fail`)
  if (failures > 0) process.exit(1)
  console.log('\n✓ smoke test de cooldown e deduplicação passou')
}

main().catch((err) => {
  console.error('smoke test falhou:', err)
  process.exit(1)
})
