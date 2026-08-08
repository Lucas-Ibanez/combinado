// Smoke test de T7.5 — Encerrar/reabrir e reagir à confirmação.
//
// Verifica:
//   1. acknowledgeIncident para escada e marca incidente como acknowledged
//   2. acknowledgeIncident registra ack na delivery ativa
//   3. tickLadder não avança incidente acknowledged (escada parou)
//   4. Novo sinal reabre incidente acknowledged e reinicia escada
//   5. Reabertura faz upgrade de severidade se novo sinal é mais grave
//   6. acknowledgeIncident em incidente inexistente → not_found
//   7. acknowledgeIncident em incidente já acknowledged → already_acknowledged
//   8. acknowledgeIncident em incidente open (não notifying) → wrong_status
//   9. Resiliência: tickLadder retoma escadas ativas após "reinício"
//  10. Incidente reaberto pode ser acknowledged novamente
//
// Rodar: pnpm --filter @combinado/service test:lifecycle

import type { IncidentQueueMessage, Severity } from '@combinado/shared'
import { db } from '../src/shared/db/index.js'
import { createLogger } from '../src/shared/logging/index.js'
import { upsertIncident } from '../src/orchestrator/incidents.js'
import { acknowledgeIncident } from '../src/orchestrator/lifecycle.js'
import {
  startLadder,
  tickLadder,
} from '../src/orchestrator/ladder/index.js'
import { getIncidentTimeline } from '../src/orchestrator/ladder/telemetry.js'
import { _resetForTest as resetCooldown } from '../src/orchestrator/cooldown.js'

let passes = 0
let failures = 0
function assert(cond: unknown, msg: string): void {
  if (cond) {
    passes += 1
    console.log(`[ok]   ${msg}`)
  } else {
    failures += 1
    console.error(`[fail] ${msg}`)
  }
}

const log = createLogger('test-lifecycle')

const GUARDIAN_ID = '05c10858-ed6f-49f9-a21f-97446591a100'
const FAMILY_NAME = '__test_lifecycle__'
let testCounter = 0
function uniqueSender(): string {
  return `lifecycle_${++testCounter}_${Date.now()}@s.whatsapp.net`
}

const cleanupIncidents: string[] = []
const cleanupRiskEvents: string[] = []

async function ensureTestSetup(): Promise<{
  familyId: string
  protectedId: string
}> {
  const { data: existingFam } = await db
    .from('families')
    .select('id')
    .eq('name', FAMILY_NAME)
    .limit(1)
    .maybeSingle()

  const familyId = existingFam
    ? existingFam.id
    : (await db.from('families').insert({ name: FAMILY_NAME }).select('id').single()).data!.id

  const { data: existingGuardian } = await db
    .from('guardians')
    .select('id')
    .eq('id', GUARDIAN_ID)
    .maybeSingle()

  if (!existingGuardian) {
    await db.from('guardians').insert({
      id: GUARDIAN_ID,
      family_id: familyId,
      display_name: 'Guardião Lifecycle',
      phone: '+5511999990001',
      is_primary: true,
    })
  } else {
    await db
      .from('guardians')
      .update({ family_id: familyId, phone: '+5511999990001' })
      .eq('id', GUARDIAN_ID)
  }

  let protectedId: string
  {
    const { data: pp } = await db
      .from('protected_persons')
      .select('id')
      .eq('family_id', familyId)
      .eq('display_name', 'Elder Lifecycle')
      .limit(1)
      .maybeSingle()

    protectedId = pp
      ? pp.id
      : (await db.from('protected_persons').insert({
          family_id: familyId,
          display_name: 'Elder Lifecycle',
          baileys_status: 'unpaired',
        }).select('id').single()).data!.id
  }

  const { data: existingLink } = await db
    .from('guardian_links')
    .select('id')
    .eq('guardian_id', GUARDIAN_ID)
    .eq('protected_person_id', protectedId)
    .maybeSingle()

  if (!existingLink) {
    await db.from('guardian_links').insert({
      guardian_id: GUARDIAN_ID,
      protected_person_id: protectedId,
      role: 'primary',
    })
  }

  return { familyId, protectedId }
}

async function createRiskEvent(
  familyId: string,
  protectedId: string,
  severity: Severity = 'high',
): Promise<string> {
  const { data, error } = await db
    .from('risk_events')
    .insert({
      family_id: familyId,
      protected_person_id: protectedId,
      signals: { pix_mention: true },
      severity,
      decision: 'block',
      pipeline_version: 'v1-test',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`criar risk_event: ${error?.message}`)
  cleanupRiskEvents.push(data.id)
  return data.id
}

function makeMsg(
  riskEventId: string,
  familyId: string,
  protectedId: string,
  severity: Severity = 'high',
  senderJid?: string,
): IncidentQueueMessage {
  return {
    risk_event_id: riskEventId,
    event_id: `EVT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    family_id: familyId,
    protected_person_id: protectedId,
    sender_jid: senderJid ?? uniqueSender(),
    decision: 'block',
    severity,
    signals: { pix_mention: true, urgency_language: true },
    reasons: ['test'],
    processed_at: new Date().toISOString(),
  }
}

async function getIncidentStatus(id: string): Promise<{
  status: string
  acknowledged_at: string | null
  acknowledged_by: string | null
}> {
  const { data } = await db
    .from('incidents')
    .select('status, acknowledged_at, acknowledged_by')
    .eq('id', id)
    .single()
  return data ?? { status: 'unknown', acknowledged_at: null, acknowledged_by: null }
}

async function expireDeadline(deliveryId: string): Promise<void> {
  const past = new Date(Date.now() - 60_000).toISOString()
  await db
    .from('incident_deliveries')
    .update({ escalation_deadline: past })
    .eq('id', deliveryId)
}

async function main() {
  const { familyId, protectedId } = await ensureTestSetup()

  // ── 1: acknowledgeIncident para escada e marca acknowledged ──
  console.log('\n== 1: ack para escada e marca acknowledged ==')
  {
    resetCooldown()
    const re = await createRiskEvent(familyId, protectedId)
    const msg = makeMsg(re, familyId, protectedId)
    const upsert = await upsertIncident(msg, log)
    cleanupIncidents.push(upsert.incident_id)

    await startLadder(upsert.incident_id, protectedId, 'high', log)

    const ackResult = await acknowledgeIncident(upsert.incident_id, GUARDIAN_ID, log)
    assert(ackResult.success === true, 'ack retorna success')

    const incident = await getIncidentStatus(upsert.incident_id)
    assert(incident.status === 'acknowledged', `status=acknowledged (got ${incident.status})`)
    assert(incident.acknowledged_at !== null, 'acknowledged_at preenchido')
    assert(incident.acknowledged_by === GUARDIAN_ID, 'acknowledged_by correto')
  }

  // ── 2: ack registra na delivery ativa ──
  console.log('\n== 2: ack registra na delivery ativa ==')
  {
    resetCooldown()
    const re = await createRiskEvent(familyId, protectedId)
    const msg = makeMsg(re, familyId, protectedId)
    const upsert = await upsertIncident(msg, log)
    cleanupIncidents.push(upsert.incident_id)

    await startLadder(upsert.incident_id, protectedId, 'high', log)
    await acknowledgeIncident(upsert.incident_id, GUARDIAN_ID, log)

    const timeline = await getIncidentTimeline(upsert.incident_id)
    assert(timeline.length >= 1, 'timeline tem delivery')
    assert(timeline[0]!.acknowledged_at !== null, 'delivery acknowledged_at preenchido')
    assert(timeline[0]!.acknowledged_by === GUARDIAN_ID, 'delivery acknowledged_by correto')
  }

  // ── 3: tickLadder não avança incidente acknowledged ──
  console.log('\n== 3: tick não avança incidente acknowledged ==')
  {
    resetCooldown()
    const re = await createRiskEvent(familyId, protectedId)
    const msg = makeMsg(re, familyId, protectedId)
    const upsert = await upsertIncident(msg, log)
    cleanupIncidents.push(upsert.incident_id)

    await startLadder(upsert.incident_id, protectedId, 'high', log)

    // Expirar deadline ANTES do ack
    const timeline1 = await getIncidentTimeline(upsert.incident_id)
    await expireDeadline(timeline1[0]!.id)

    // Ack: para a escada
    await acknowledgeIncident(upsert.incident_id, GUARDIAN_ID, log)

    // Tick: não deveria avançar — incidente já acknowledged
    const advanced = await tickLadder(log)
    const timeline2 = await getIncidentTimeline(upsert.incident_id)

    assert(
      timeline2.length === 1,
      `escada parada após ack (deliveries=${timeline2.length})`,
    )
  }

  // ── 4: novo sinal reabre incidente acknowledged ──
  console.log('\n== 4: novo sinal reabre incidente acknowledged ==')
  {
    resetCooldown()
    const sender = uniqueSender()

    const re1 = await createRiskEvent(familyId, protectedId)
    const msg1 = makeMsg(re1, familyId, protectedId, 'high', sender)
    const upsert1 = await upsertIncident(msg1, log)
    cleanupIncidents.push(upsert1.incident_id)

    await startLadder(upsert1.incident_id, protectedId, 'high', log)
    await acknowledgeIncident(upsert1.incident_id, GUARDIAN_ID, log)

    const acked = await getIncidentStatus(upsert1.incident_id)
    assert(acked.status === 'acknowledged', 'incidente acknowledged antes do novo sinal')

    resetCooldown()
    const re2 = await createRiskEvent(familyId, protectedId)
    const msg2 = makeMsg(re2, familyId, protectedId, 'high', sender)
    const upsert2 = await upsertIncident(msg2, log)

    assert(upsert2.incident_id === upsert1.incident_id, 'mesmo incident_id (reaberto)')
    assert(upsert2.reopened === true, 'reopened=true')
    assert(upsert2.created === false, 'created=false (reaberto, não criado)')

    const reopened = await getIncidentStatus(upsert1.incident_id)
    assert(reopened.status === 'open', `status voltou para open (got ${reopened.status})`)
    assert(reopened.acknowledged_at === null, 'acknowledged_at limpo')
    assert(reopened.acknowledged_by === null, 'acknowledged_by limpo')
  }

  // ── 5: reabertura com upgrade de severidade ──
  console.log('\n== 5: reabertura com upgrade de severidade ==')
  {
    resetCooldown()
    const sender = uniqueSender()

    const re1 = await createRiskEvent(familyId, protectedId, 'medium')
    const msg1 = makeMsg(re1, familyId, protectedId, 'medium', sender)
    const upsert1 = await upsertIncident(msg1, log)
    cleanupIncidents.push(upsert1.incident_id)

    await startLadder(upsert1.incident_id, protectedId, 'medium', log)
    await acknowledgeIncident(upsert1.incident_id, GUARDIAN_ID, log)

    resetCooldown()
    const re2 = await createRiskEvent(familyId, protectedId, 'critical')
    const msg2 = makeMsg(re2, familyId, protectedId, 'critical', sender)
    const upsert2 = await upsertIncident(msg2, log)

    assert(upsert2.reopened === true, 'reaberto')
    assert(upsert2.severity === 'critical', `upgrade para critical (got ${upsert2.severity})`)
    assert(upsert2.previous_severity === 'medium', `previous era medium (got ${upsert2.previous_severity})`)
  }

  // ── 6: ack em incidente inexistente ──
  console.log('\n== 6: ack em incidente inexistente ==')
  {
    const result = await acknowledgeIncident('00000000-0000-0000-0000-000000000000', GUARDIAN_ID, log)
    assert(result.success === false, 'não sucesso')
    assert(result.reason === 'not_found', `reason=not_found (got ${result.reason})`)
  }

  // ── 7: ack em incidente já acknowledged ──
  console.log('\n== 7: ack em incidente já acknowledged ==')
  {
    resetCooldown()
    const re = await createRiskEvent(familyId, protectedId)
    const msg = makeMsg(re, familyId, protectedId)
    const upsert = await upsertIncident(msg, log)
    cleanupIncidents.push(upsert.incident_id)

    await startLadder(upsert.incident_id, protectedId, 'high', log)
    await acknowledgeIncident(upsert.incident_id, GUARDIAN_ID, log)

    const result = await acknowledgeIncident(upsert.incident_id, GUARDIAN_ID, log)
    assert(result.success === false, 'segundo ack não sucesso')
    assert(result.reason === 'already_acknowledged', `reason=already_acknowledged (got ${result.reason})`)
  }

  // ── 8: ack em incidente com status 'open' (não notifying) ──
  console.log('\n== 8: ack em incidente open → wrong_status ==')
  {
    // Criar incidente diretamente no status 'open' sem escada
    const { data: inc } = await db
      .from('incidents')
      .insert({
        family_id: familyId,
        protected_person_id: protectedId,
        status: 'open',
        severity: 'high',
        source_contact: 'test_status@s.whatsapp.net',
        summary: 'test wrong status',
      })
      .select('id')
      .single()
    cleanupIncidents.push(inc!.id)

    const result = await acknowledgeIncident(inc!.id, GUARDIAN_ID, log)
    assert(result.success === false, 'ack em open não sucesso')
    assert(result.reason === 'wrong_status', `reason=wrong_status (got ${result.reason})`)
  }

  // ── 9: resiliência — tickLadder retoma escadas ativas ──
  console.log('\n== 9: resiliência — tick retoma escadas ativas ==')
  {
    resetCooldown()
    const re = await createRiskEvent(familyId, protectedId)
    const msg = makeMsg(re, familyId, protectedId)
    const upsert = await upsertIncident(msg, log)
    cleanupIncidents.push(upsert.incident_id)

    await startLadder(upsert.incident_id, protectedId, 'high', log)

    // Simular "reinício": não temos referência ao timer, mas tickLadder
    // deve encontrar o incidente notifying e seu delivery com deadline expirado
    const timeline1 = await getIncidentTimeline(upsert.incident_id)
    await expireDeadline(timeline1[0]!.id)

    // tick "pós-reinício" retoma a escada
    const advanced = await tickLadder(log)
    assert(advanced >= 1, `tick avançou ao menos 1 (got ${advanced})`)

    const timeline2 = await getIncidentTimeline(upsert.incident_id)
    assert(timeline2.length === 2, `escada avançou: 2 deliveries (got ${timeline2.length})`)
    assert(timeline2[1]!.channel === 'whatsapp', 'segundo degrau: whatsapp')
  }

  // ── 10: incidente reaberto pode ser acked novamente ──
  console.log('\n== 10: reaberto → ladder → ack novamente ==')
  {
    resetCooldown()
    const sender = uniqueSender()

    const re1 = await createRiskEvent(familyId, protectedId)
    const msg1 = makeMsg(re1, familyId, protectedId, 'high', sender)
    const upsert1 = await upsertIncident(msg1, log)
    cleanupIncidents.push(upsert1.incident_id)
    await startLadder(upsert1.incident_id, protectedId, 'high', log)
    await acknowledgeIncident(upsert1.incident_id, GUARDIAN_ID, log)

    resetCooldown()
    const re2 = await createRiskEvent(familyId, protectedId)
    const msg2 = makeMsg(re2, familyId, protectedId, 'high', sender)
    const upsert2 = await upsertIncident(msg2, log)
    assert(upsert2.reopened === true, 'reaberto')

    // Iniciar nova escada
    await startLadder(upsert2.incident_id, protectedId, upsert2.severity, log)

    const status1 = await getIncidentStatus(upsert2.incident_id)
    assert(status1.status === 'notifying', `reaberto → notifying (got ${status1.status})`)

    // Ack de novo
    const ack2 = await acknowledgeIncident(upsert2.incident_id, GUARDIAN_ID, log)
    assert(ack2.success === true, 'segundo ack sucesso')

    const status2 = await getIncidentStatus(upsert2.incident_id)
    assert(status2.status === 'acknowledged', `re-acked → acknowledged (got ${status2.status})`)
  }

  // ── Cleanup ──
  for (const id of cleanupIncidents) {
    await db.from('incident_deliveries').delete().eq('incident_id', id)
    await db.from('risk_events').update({ incident_id: null }).eq('incident_id', id)
    await db.from('incidents').delete().eq('id', id)
  }
  for (const id of cleanupRiskEvents) {
    await db.from('risk_events').delete().eq('id', id)
  }

  console.log(`\nresumo: ${passes} ok, ${failures} fail`)
  if (failures > 0) process.exit(1)
  console.log('\n✓ smoke test de lifecycle (ack + reopen) passou')
}

main().catch((err) => {
  console.error('smoke test falhou:', err)
  process.exit(1)
})
