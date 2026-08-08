// Smoke test de T7.4 — Registrar cada delivery com telemetria.
//
// Verifica:
//   1. Timeline de um incidente mostra cada tentativa com todos os campos
//   2. sent_at e escalation_deadline são preenchidos ao criar degrau
//   3. recordDelivered preenche delivered_at
//   4. recordAcknowledgment preenche acknowledged_at e acknowledged_by
//   5. Dispatch failure: registra failure_reason e avança para próximo degrau
//   6. Timeline completa mostra desfecho de cada degrau (timeout, falha, ack)
//   7. Múltiplas falhas consecutivas pulam para o próximo canal funcional
//   8. idempotência: recordDelivered/recordAcknowledgment não sobrescreve se já preenchido
//
// Rodar: pnpm --filter @combinado/service test:delivery-telemetry

import type { DeliveryChannel, Severity } from '@combinado/shared'
import type { Logger } from '../src/shared/logging/index.js'
import { db } from '../src/shared/db/index.js'
import { createLogger } from '../src/shared/logging/index.js'
import {
  startLadder,
  tickLadder,
} from '../src/orchestrator/ladder/index.js'
import {
  getIncidentTimeline,
  recordDelivered,
  recordAcknowledgment,
} from '../src/orchestrator/ladder/telemetry.js'
import {
  _setDispatcherForTest,
  _resetDispatcherForTest,
} from '../src/orchestrator/ladder/dispatch.js'
import type { ChannelDispatcher } from '../src/orchestrator/ladder/dispatch.js'

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

const log = createLogger('test-delivery-telemetry')

const GUARDIAN_ID = '05c10858-ed6f-49f9-a21f-97446591a100'
const FAMILY_NAME = '__test_delivery_telemetry__'

const cleanupIncidents: string[] = []

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
      display_name: 'Guardião Teste Telemetry',
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
      .eq('display_name', 'Elder Telemetry')
      .limit(1)
      .maybeSingle()

    protectedId = pp
      ? pp.id
      : (await db.from('protected_persons').insert({
          family_id: familyId,
          display_name: 'Elder Telemetry',
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

async function createIncident(
  familyId: string,
  protectedId: string,
  severity: Severity = 'high',
): Promise<string> {
  const { data, error } = await db
    .from('incidents')
    .insert({
      family_id: familyId,
      protected_person_id: protectedId,
      status: 'open',
      severity,
      source_contact: `tel_${Date.now()}@s.whatsapp.net`,
      summary: 'test telemetry incident',
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`criar incidente: ${error?.message}`)
  cleanupIncidents.push(data.id)
  return data.id
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

  // ── 1: Timeline mostra todos os campos ──
  console.log('\n== 1: Timeline com todos os campos ==')
  {
    const incidentId = await createIncident(familyId, protectedId)
    await startLadder(incidentId, protectedId, 'high', log)

    const timeline = await getIncidentTimeline(incidentId)
    assert(timeline.length === 1, `1 delivery na timeline (got ${timeline.length})`)

    const d = timeline[0]!
    assert(d.incident_id === incidentId, 'incident_id correto')
    assert(d.channel === 'push', `channel=push (got ${d.channel})`)
    assert(d.target_guardian_id === GUARDIAN_ID, 'target_guardian correto')
    assert(d.target_phone === '+5511999990001', `target_phone correto (got ${d.target_phone})`)
    assert(d.step_order === 0, `step_order=0 (got ${d.step_order})`)
    assert(d.sent_at !== null, 'sent_at preenchido')
    assert(d.escalation_deadline !== null, 'escalation_deadline preenchido')
    assert(d.delivered_at === null, 'delivered_at inicialmente null')
    assert(d.acknowledged_at === null, 'acknowledged_at inicialmente null')
    assert(d.acknowledged_by === null, 'acknowledged_by inicialmente null')
    assert(d.failure_reason === null, 'failure_reason inicialmente null')
    assert(typeof d.id === 'string' && d.id.length > 0, 'delivery id existe')
    assert(d.created_at !== null, 'created_at preenchido')
  }

  // ── 2: recordDelivered preenche delivered_at ──
  console.log('\n== 2: recordDelivered ==')
  {
    const incidentId = await createIncident(familyId, protectedId)
    await startLadder(incidentId, protectedId, 'high', log)

    const timeline = await getIncidentTimeline(incidentId)
    const deliveryId = timeline[0]!.id

    const ok = await recordDelivered(deliveryId, log)
    assert(ok === true, 'recordDelivered retorna true')

    const after = await getIncidentTimeline(incidentId)
    assert(after[0]!.delivered_at !== null, 'delivered_at preenchido após record')

    const deliveredAt = new Date(after[0]!.delivered_at!).getTime()
    const now = Date.now()
    assert(
      Math.abs(now - deliveredAt) < 5000,
      'delivered_at é recente (< 5s)',
    )
  }

  // ── 3: recordAcknowledgment preenche acknowledged_at e acknowledged_by ──
  console.log('\n== 3: recordAcknowledgment ==')
  {
    const incidentId = await createIncident(familyId, protectedId)
    await startLadder(incidentId, protectedId, 'high', log)

    const timeline = await getIncidentTimeline(incidentId)
    const deliveryId = timeline[0]!.id

    const ok = await recordAcknowledgment(deliveryId, GUARDIAN_ID, log)
    assert(ok === true, 'recordAcknowledgment retorna true')

    const after = await getIncidentTimeline(incidentId)
    assert(after[0]!.acknowledged_at !== null, 'acknowledged_at preenchido')
    assert(after[0]!.acknowledged_by === GUARDIAN_ID, 'acknowledged_by correto')
  }

  // ── 4: Dispatch failure registra e avança ──
  console.log('\n== 4: Dispatch failure → registra e avança ==')
  {
    _setDispatcherForTest({
      async send(channel: DeliveryChannel, _target, _incidentId, _log) {
        if (channel === 'push') {
          return { sent: false, error: 'push_service_unavailable' }
        }
        return { sent: true }
      },
    })

    const incidentId = await createIncident(familyId, protectedId)
    await startLadder(incidentId, protectedId, 'high', log)

    const timeline = await getIncidentTimeline(incidentId)
    assert(timeline.length === 2, `2 deliveries após falha push (got ${timeline.length})`)

    const pushStep = timeline.find((d) => d.channel === 'push')
    assert(pushStep !== undefined, 'push step existe na timeline')
    assert(
      pushStep!.failure_reason?.includes('dispatch_failed'),
      `push failure_reason registrado (got ${pushStep!.failure_reason})`,
    )
    assert(
      pushStep!.failure_reason?.includes('push_service_unavailable'),
      'push failure_reason contém motivo original',
    )

    const whatsappStep = timeline.find((d) => d.channel === 'whatsapp')
    assert(whatsappStep !== undefined, 'whatsapp step criado após falha push')
    assert(whatsappStep!.failure_reason === null, 'whatsapp não tem failure')
    assert(whatsappStep!.sent_at !== null, 'whatsapp sent_at preenchido')

    _resetDispatcherForTest()
  }

  // ── 5: Múltiplas falhas consecutivas ──
  console.log('\n== 5: Múltiplas falhas → pula para canal funcional ==')
  {
    _setDispatcherForTest({
      async send(channel: DeliveryChannel, _target, _incidentId, _log) {
        if (channel === 'push' || channel === 'whatsapp') {
          return { sent: false, error: `${channel}_down` }
        }
        return { sent: true }
      },
    })

    const incidentId = await createIncident(familyId, protectedId)
    await startLadder(incidentId, protectedId, 'high', log)

    const timeline = await getIncidentTimeline(incidentId)
    assert(timeline.length === 3, `3 deliveries: push(fail)+wa(fail)+sms(ok) (got ${timeline.length})`)

    const channels = timeline.map((d) => d.channel)
    assert(channels.join(',') === 'push,whatsapp,sms', `canais: ${channels.join(',')}`)

    assert(timeline[0]!.failure_reason?.includes('dispatch_failed'), 'push falhou')
    assert(timeline[1]!.failure_reason?.includes('dispatch_failed'), 'whatsapp falhou')
    assert(timeline[2]!.failure_reason === null, 'sms sem falha')

    _resetDispatcherForTest()
  }

  // ── 6: Timeline completa com timeout + ack ──
  console.log('\n== 6: Timeline completa: timeout → ack ==')
  {
    const incidentId = await createIncident(familyId, protectedId)
    await startLadder(incidentId, protectedId, 'high', log)

    // Step 0: push — timeout
    let timeline = await getIncidentTimeline(incidentId)
    await expireDeadline(timeline[0]!.id)
    await tickLadder(log)

    // Step 1: whatsapp — delivered + ack
    timeline = await getIncidentTimeline(incidentId)
    assert(timeline.length === 2, '2 deliveries após escalação')

    const waDelivery = timeline[1]!
    await recordDelivered(waDelivery.id, log)
    await recordAcknowledgment(waDelivery.id, GUARDIAN_ID, log)

    timeline = await getIncidentTimeline(incidentId)

    // Verificar timeline completa
    const step0 = timeline[0]!
    assert(step0.channel === 'push', 'step 0: push')
    assert(step0.sent_at !== null, 'step 0: sent_at')
    assert(step0.failure_reason === 'timeout_escalated', 'step 0: timeout')
    assert(step0.acknowledged_at === null, 'step 0: sem ack')

    const step1 = timeline[1]!
    assert(step1.channel === 'whatsapp', 'step 1: whatsapp')
    assert(step1.sent_at !== null, 'step 1: sent_at')
    assert(step1.delivered_at !== null, 'step 1: delivered_at')
    assert(step1.acknowledged_at !== null, 'step 1: acknowledged_at')
    assert(step1.acknowledged_by === GUARDIAN_ID, 'step 1: acknowledged_by')
    assert(step1.failure_reason === null, 'step 1: sem falha')
  }

  // ── 7: Idempotência: segundo record não sobrescreve ──
  console.log('\n== 7: Idempotência de recordDelivered e recordAcknowledgment ==')
  {
    const incidentId = await createIncident(familyId, protectedId)
    await startLadder(incidentId, protectedId, 'high', log)

    const timeline = await getIncidentTimeline(incidentId)
    const deliveryId = timeline[0]!.id

    await recordDelivered(deliveryId, log)
    const firstTimeline = await getIncidentTimeline(incidentId)
    const firstDeliveredAt = firstTimeline[0]!.delivered_at

    // Pequena pausa para garantir timestamp diferente
    await new Promise((r) => setTimeout(r, 50))

    await recordDelivered(deliveryId, log)
    const secondTimeline = await getIncidentTimeline(incidentId)
    assert(
      secondTimeline[0]!.delivered_at === firstDeliveredAt,
      'delivered_at não muda no segundo record',
    )

    await recordAcknowledgment(deliveryId, GUARDIAN_ID, log)
    const thirdTimeline = await getIncidentTimeline(incidentId)
    const firstAckAt = thirdTimeline[0]!.acknowledged_at

    await new Promise((r) => setTimeout(r, 50))

    await recordAcknowledgment(deliveryId, 'outro-guardian-id', log)
    const fourthTimeline = await getIncidentTimeline(incidentId)
    assert(
      fourthTimeline[0]!.acknowledged_at === firstAckAt,
      'acknowledged_at não muda no segundo record',
    )
    assert(
      fourthTimeline[0]!.acknowledged_by === GUARDIAN_ID,
      'acknowledged_by mantém o original',
    )
  }

  // ── 8: Severidade afeta deadline registrado ──
  console.log('\n== 8: Deadline na timeline reflete severidade ==')
  {
    const critId = await createIncident(familyId, protectedId, 'critical')
    await startLadder(critId, protectedId, 'critical', log)

    const lowId = await createIncident(familyId, protectedId, 'low')
    await startLadder(lowId, protectedId, 'low', log)

    const critTimeline = await getIncidentTimeline(critId)
    const lowTimeline = await getIncidentTimeline(lowId)

    const critSent = new Date(critTimeline[0]!.sent_at!).getTime()
    const critDead = new Date(critTimeline[0]!.escalation_deadline!).getTime()
    const critWindow = critDead - critSent

    const lowSent = new Date(lowTimeline[0]!.sent_at!).getTime()
    const lowDead = new Date(lowTimeline[0]!.escalation_deadline!).getTime()
    const lowWindow = lowDead - lowSent

    assert(
      critWindow < lowWindow,
      `critical window (${critWindow}ms) < low window (${lowWindow}ms)`,
    )
    assert(
      Math.abs(critWindow - 60_000) < 2000,
      `critical push ≈ 60s (got ${critWindow}ms)`,
    )
    assert(
      Math.abs(lowWindow - 300_000) < 2000,
      `low push ≈ 300s (got ${lowWindow}ms)`,
    )
  }

  // ── Cleanup ──
  for (const id of cleanupIncidents) {
    await db.from('incident_deliveries').delete().eq('incident_id', id)
    await db.from('incidents').delete().eq('id', id)
  }

  console.log(`\nresumo: ${passes} ok, ${failures} fail`)
  if (failures > 0) process.exit(1)
  console.log('\n✓ smoke test de telemetria de delivery passou')
}

main().catch((err) => {
  console.error('smoke test falhou:', err)
  process.exit(1)
})
