// Smoke test de T7.1 — Criar/atualizar incidente.
//
// Verifica:
//   1. Decisão cria um novo incidente com estado e severidade corretos
//   2. Segunda decisão do mesmo contato AGRUPA no existente (não cria outro)
//   3. Agrupamento faz upgrade de severidade se a nova é mais alta
//   4. risk_event é vinculado ao incidente (incident_id preenchido)
//   5. Contato diferente cria incidente separado
//
// Rodar: pnpm --filter @combinado/service test:incident-upsert
import type { IncidentQueueMessage } from '@combinado/shared'
import { db } from '../src/shared/db/index.js'
import { createLogger } from '../src/shared/logging/index.js'
import { upsertIncident } from '../src/orchestrator/incidents.js'

let passes = 0, failures = 0
function assert(cond: unknown, msg: string): void {
  if (cond) { passes += 1; console.log(`[ok]   ${msg}`) }
  else { failures += 1; console.error(`[fail] ${msg}`) }
}

const log = createLogger('test-incident-upsert')

async function ensureTestFamily(): Promise<{ familyId: string; protectedId: string }> {
  const { data: existing } = await db
    .from('families')
    .select('id')
    .eq('name', '__test_incident_upsert__')
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
    .insert({ name: '__test_incident_upsert__' })
    .select('id')
    .single()
  if (!family) throw new Error('criar família falhou')

  const { data: pp } = await db
    .from('protected_persons')
    .insert({
      family_id: family.id,
      display_name: 'Test Elder Upsert',
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
  decision: string,
  severity: string,
): Promise<string> {
  const { data, error } = await db
    .from('risk_events')
    .insert({
      family_id: familyId,
      protected_person_id: protectedId,
      signals: { pix_mention: true },
      severity,
      decision,
      pipeline_version: 'v1-test',
    })
    .select('id, processed_at')
    .single()
  if (error || !data) throw new Error(`criar risk_event: ${error?.message}`)
  return data.id
}

function makeMsg(
  overrides: Partial<IncidentQueueMessage> & {
    risk_event_id: string
    family_id: string
    protected_person_id: string
  },
): IncidentQueueMessage {
  return {
    event_id: `EVT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sender_jid: '5511999990001@s.whatsapp.net',
    decision: 'block',
    severity: 'high',
    signals: { pix_mention: true, urgency_language: true },
    reasons: ['test reason'],
    processed_at: new Date().toISOString(),
    ...overrides,
  }
}

// IDs para cleanup
const createdIncidentIds: string[] = []
const createdRiskEventIds: string[] = []

async function main() {
  const { familyId, protectedId } = await ensureTestFamily()

  // ── 1: primeira decisão → cria incidente novo ──
  console.log('\n== 1: nova decisão → incidente criado ==')
  const re1 = await createRiskEvent(familyId, protectedId, 'block', 'high')
  createdRiskEventIds.push(re1)

  const msg1 = makeMsg({
    risk_event_id: re1,
    family_id: familyId,
    protected_person_id: protectedId,
    severity: 'high',
    decision: 'block',
  })

  const result1 = await upsertIncident(msg1, log)
  createdIncidentIds.push(result1.incident_id)

  assert(result1.created === true, 'primeiro evento → incidente criado')
  assert(result1.severity === 'high', `severity=high (got ${result1.severity})`)

  // Verificar no DB
  const { data: inc1 } = await db
    .from('incidents')
    .select('*')
    .eq('id', result1.incident_id)
    .single()
  assert(inc1?.status === 'open', `status=open (got ${inc1?.status})`)
  assert(inc1?.severity === 'high', `DB severity=high (got ${inc1?.severity})`)
  assert(inc1?.source_contact === msg1.sender_jid, 'source_contact registrado')
  assert(inc1?.family_id === familyId, 'family_id correto')

  // risk_event vinculado
  const { data: re1Check } = await db
    .from('risk_events')
    .select('incident_id')
    .eq('id', re1)
    .single()
  assert(re1Check?.incident_id === result1.incident_id, 'risk_event vinculado ao incidente')

  // ── 2: segundo evento do MESMO contato → agrupa, não cria novo ──
  console.log('\n== 2: mesmo contato → agrupado (não cria novo) ==')
  const re2 = await createRiskEvent(familyId, protectedId, 'block', 'high')
  createdRiskEventIds.push(re2)

  const msg2 = makeMsg({
    risk_event_id: re2,
    family_id: familyId,
    protected_person_id: protectedId,
    sender_jid: msg1.sender_jid,
    severity: 'high',
    decision: 'block',
  })

  const result2 = await upsertIncident(msg2, log)

  assert(result2.created === false, 'segundo evento → agrupado, não criado')
  assert(result2.incident_id === result1.incident_id, 'mesmo incident_id')

  // risk_event 2 vinculado ao mesmo incidente
  const { data: re2Check } = await db
    .from('risk_events')
    .select('incident_id')
    .eq('id', re2)
    .single()
  assert(re2Check?.incident_id === result1.incident_id, 'risk_event 2 vinculado ao mesmo incidente')

  // Verificar que só existe 1 incidente para esse contato
  const { data: allInc } = await db
    .from('incidents')
    .select('id')
    .eq('family_id', familyId)
    .eq('protected_person_id', protectedId)
    .eq('source_contact', msg1.sender_jid)
    .in('status', ['open', 'notifying', 'escalated'])
  assert(allInc?.length === 1, `apenas 1 incidente aberto (got ${allInc?.length})`)

  // ── 3: agrupamento com upgrade de severidade ──
  console.log('\n== 3: agrupamento com upgrade de severidade ==')
  const re3 = await createRiskEvent(familyId, protectedId, 'block', 'critical')
  createdRiskEventIds.push(re3)

  const msg3 = makeMsg({
    risk_event_id: re3,
    family_id: familyId,
    protected_person_id: protectedId,
    sender_jid: msg1.sender_jid,
    severity: 'critical',
    decision: 'block',
  })

  const result3 = await upsertIncident(msg3, log)

  assert(result3.created === false, 'agrupou no existente')
  assert(result3.severity === 'critical', `severity upgraded → critical (got ${result3.severity})`)
  assert(result3.previous_severity === 'high', `previous=high (got ${result3.previous_severity})`)

  // Verificar upgrade no DB
  const { data: inc1Updated } = await db
    .from('incidents')
    .select('severity')
    .eq('id', result1.incident_id)
    .single()
  assert(inc1Updated?.severity === 'critical', `DB severity → critical (got ${inc1Updated?.severity})`)

  // ── 4: contato DIFERENTE → incidente separado ──
  console.log('\n== 4: contato diferente → incidente novo ==')
  const re4 = await createRiskEvent(familyId, protectedId, 'review', 'medium')
  createdRiskEventIds.push(re4)

  const msg4 = makeMsg({
    risk_event_id: re4,
    family_id: familyId,
    protected_person_id: protectedId,
    sender_jid: '5511888880002@s.whatsapp.net',
    severity: 'medium',
    decision: 'review',
  })

  const result4 = await upsertIncident(msg4, log)
  createdIncidentIds.push(result4.incident_id)

  assert(result4.created === true, 'contato diferente → incidente novo')
  assert(result4.incident_id !== result1.incident_id, 'ID diferente do primeiro')

  // ── 5: incidente fechado não é reutilizado ──
  console.log('\n== 5: incidente fechado → cria novo ==')
  // Fechar o primeiro incidente
  await db
    .from('incidents')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', result1.incident_id)

  const re5 = await createRiskEvent(familyId, protectedId, 'block', 'high')
  createdRiskEventIds.push(re5)

  const msg5 = makeMsg({
    risk_event_id: re5,
    family_id: familyId,
    protected_person_id: protectedId,
    sender_jid: msg1.sender_jid,
    severity: 'high',
    decision: 'block',
  })

  const result5 = await upsertIncident(msg5, log)
  createdIncidentIds.push(result5.incident_id)

  assert(result5.created === true, 'incidente fechado → novo criado')
  assert(result5.incident_id !== result1.incident_id, 'ID diferente do fechado')

  // ── Cleanup ──
  for (const id of createdRiskEventIds) {
    await db.from('risk_events').delete().eq('id', id)
  }
  for (const id of createdIncidentIds) {
    await db.from('incidents').delete().eq('id', id)
  }

  console.log(`\nresumo: ${passes} ok, ${failures} fail`)
  if (failures > 0) process.exit(1)
  console.log('\n✓ smoke test de criação/agrupamento de incidentes passou')
}

main().catch((err) => {
  console.error('smoke test falhou:', err)
  process.exit(1)
})
