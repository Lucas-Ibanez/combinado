// Smoke test de T7.3 — Máquina de estados da escada de entrega.
//
// Verifica:
//   1. Definição da escada: 6 degraus, 4 primários, 2 secundários
//   2. startLadder cria o primeiro degrau (push) e muda incidente → notifying
//   3. tickLadder não avança se deadline não expirou
//   4. tickLadder avança da etapa 0 para 1 quando o prazo expira
//   5. Escada completa sem confirmação → avança todos os degraus → expired
//   6. Escada para quando incidente é acknowledged
//   7. Severidades diferentes → timeouts proporcionais
//   8. Sem 2º guardião: pula degraus secondary, expira após os 4 primários
//
// Rodar: pnpm --filter @combinado/service test:ladder

import type { Severity } from '@combinado/shared'
import { db } from '../src/shared/db/index.js'
import { createLogger } from '../src/shared/logging/index.js'
import {
  startLadder,
  tickLadder,
  getLadderDefinition,
  ladderLength,
  primaryStepCount,
} from '../src/orchestrator/ladder/index.js'

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

const log = createLogger('test-ladder')

const GUARDIAN_ID = '05c10858-ed6f-49f9-a21f-97446591a100'
const FAMILY_NAME = '__test_ladder__'

const cleanupIncidents: string[] = []

async function ensureTestSetup(): Promise<{
  familyId: string
  protectedId: string
  protectedIdNoSecondary: string
}> {
  // Family
  const { data: existingFam } = await db
    .from('families')
    .select('id')
    .eq('name', FAMILY_NAME)
    .limit(1)
    .maybeSingle()

  const familyId = existingFam
    ? existingFam.id
    : (await db.from('families').insert({ name: FAMILY_NAME }).select('id').single()).data!.id

  // Guardian (reusa o auth user do Lucas)
  const { data: existingGuardian } = await db
    .from('guardians')
    .select('id')
    .eq('id', GUARDIAN_ID)
    .maybeSingle()

  if (!existingGuardian) {
    const { error: gErr } = await db.from('guardians').insert({
      id: GUARDIAN_ID,
      family_id: familyId,
      display_name: 'Guardião Teste Ladder',
      phone: '+5511999990001',
      is_primary: true,
    })
    if (gErr) throw new Error(`insert guardian: ${gErr.message}`)
  } else {
    await db
      .from('guardians')
      .update({ family_id: familyId, phone: '+5511999990001' })
      .eq('id', GUARDIAN_ID)
  }

  // Protected person (com guardian link)
  let protectedId: string
  {
    const { data: pp } = await db
      .from('protected_persons')
      .select('id')
      .eq('family_id', familyId)
      .eq('display_name', 'Elder Ladder With Guardian')
      .limit(1)
      .maybeSingle()

    protectedId = pp
      ? pp.id
      : (await db.from('protected_persons').insert({
          family_id: familyId,
          display_name: 'Elder Ladder With Guardian',
          baileys_status: 'unpaired',
        }).select('id').single()).data!.id
  }

  // Guardian link (primary)
  const { data: existingLink } = await db
    .from('guardian_links')
    .select('id')
    .eq('guardian_id', GUARDIAN_ID)
    .eq('protected_person_id', protectedId)
    .maybeSingle()

  if (!existingLink) {
    const { error: linkErr } = await db.from('guardian_links').insert({
      guardian_id: GUARDIAN_ID,
      protected_person_id: protectedId,
      role: 'primary',
    })
    if (linkErr) throw new Error(`insert guardian_link: ${linkErr.message}`)
  }

  // Protected person sem secundário (para testar skip secondary)
  let protectedIdNoSecondary: string
  {
    const { data: pp2 } = await db
      .from('protected_persons')
      .select('id')
      .eq('family_id', familyId)
      .eq('display_name', 'Elder Ladder No Secondary')
      .limit(1)
      .maybeSingle()

    protectedIdNoSecondary = pp2
      ? pp2.id
      : (await db.from('protected_persons').insert({
          family_id: familyId,
          display_name: 'Elder Ladder No Secondary',
          baileys_status: 'unpaired',
        }).select('id').single()).data!.id
  }

  // Guardian link só primary para o segundo protegido
  const { data: existingLink2 } = await db
    .from('guardian_links')
    .select('id')
    .eq('guardian_id', GUARDIAN_ID)
    .eq('protected_person_id', protectedIdNoSecondary)
    .maybeSingle()

  if (!existingLink2) {
    await db.from('guardian_links').insert({
      guardian_id: GUARDIAN_ID,
      protected_person_id: protectedIdNoSecondary,
      role: 'primary',
    })
  }

  return { familyId, protectedId, protectedIdNoSecondary }
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
      source_contact: `test_${Date.now()}@s.whatsapp.net`,
      summary: 'test ladder incident',
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`criar incidente: ${error?.message}`)
  cleanupIncidents.push(data.id)
  return data.id
}

async function getIncidentStatus(id: string): Promise<string> {
  const { data } = await db
    .from('incidents')
    .select('status')
    .eq('id', id)
    .single()
  return data?.status ?? 'unknown'
}

async function getDeliveries(
  incidentId: string,
): Promise<Array<{
  id: string
  step_order: number
  channel: string
  failure_reason: string | null
  acknowledged_at: string | null
  escalation_deadline: string | null
  target_guardian_id: string | null
}>> {
  const { data } = await db
    .from('incident_deliveries')
    .select('id, step_order, channel, failure_reason, acknowledged_at, escalation_deadline, target_guardian_id')
    .eq('incident_id', incidentId)
    .order('step_order', { ascending: true })

  return (data ?? []) as any
}

async function expireDeadline(deliveryId: string): Promise<void> {
  const past = new Date(Date.now() - 60_000).toISOString()
  await db
    .from('incident_deliveries')
    .update({ escalation_deadline: past })
    .eq('id', deliveryId)
}

async function main() {
  const { familyId, protectedId, protectedIdNoSecondary } = await ensureTestSetup()

  // ── 1: Definição da escada ──
  console.log('\n== 1: Definição da escada ==')
  {
    const ladder = getLadderDefinition()
    assert(ladder.length === 6, `escada tem 6 degraus (got ${ladder.length})`)
    assert(ladderLength() === 6, 'ladderLength() === 6')
    assert(primaryStepCount() === 4, `4 degraus primários (got ${primaryStepCount()})`)
    assert(ladder[0]!.channel === 'push', 'primeiro degrau: push')
    assert(ladder[0]!.target === 'primary', 'primeiro alvo: primary')
    assert(ladder[4]!.target === 'secondary', 'degrau 4: secondary')
    assert(ladder[5]!.channel === 'whatsapp', 'último degrau: whatsapp secondary')
  }

  // ── 2: startLadder cria primeiro degrau e muda status ──
  console.log('\n== 2: startLadder cria primeiro degrau ==')
  {
    const incidentId = await createIncident(familyId, protectedId)
    await startLadder(incidentId, protectedId, 'high', log)

    const status = await getIncidentStatus(incidentId)
    assert(status === 'notifying', `status=notifying (got ${status})`)

    const deliveries = await getDeliveries(incidentId)
    assert(deliveries.length === 1, `1 delivery criada (got ${deliveries.length})`)
    assert(deliveries[0]!.channel === 'push', `canal=push (got ${deliveries[0]!.channel})`)
    assert(deliveries[0]!.step_order === 0, `step_order=0 (got ${deliveries[0]!.step_order})`)
    assert(deliveries[0]!.escalation_deadline !== null, 'deadline definido')
    assert(deliveries[0]!.target_guardian_id === GUARDIAN_ID, 'target_guardian correto')
  }

  // ── 3: tickLadder não avança se deadline não expirou ──
  console.log('\n== 3: tick sem deadline expirado ==')
  {
    const incidentId = await createIncident(familyId, protectedId)
    await startLadder(incidentId, protectedId, 'high', log)

    const before = await getDeliveries(incidentId)
    await tickLadder(log)
    const after = await getDeliveries(incidentId)

    assert(
      after.length === before.length,
      `nenhum degrau adicionado (${before.length} → ${after.length})`,
    )
  }

  // ── 4: tickLadder avança quando deadline expira ──
  console.log('\n== 4: tick avança com deadline expirado ==')
  {
    const incidentId = await createIncident(familyId, protectedId)
    await startLadder(incidentId, protectedId, 'high', log)

    const deliveries = await getDeliveries(incidentId)
    await expireDeadline(deliveries[0]!.id)

    await tickLadder(log)

    const after = await getDeliveries(incidentId)
    assert(after.length === 2, `2 deliveries após tick (got ${after.length})`)
    assert(
      after[0]!.failure_reason === 'timeout_escalated',
      `step 0 marcado como escalado (got ${after[0]!.failure_reason})`,
    )
    assert(
      after[1]!.channel === 'whatsapp',
      `segundo degrau: whatsapp (got ${after[1]?.channel})`,
    )
  }

  // ── 5: Escada completa sem confirmação → expired ──
  console.log('\n== 5: Escada completa sem confirmação (só primary) ==')
  {
    const incidentId = await createIncident(familyId, protectedIdNoSecondary)
    await startLadder(incidentId, protectedIdNoSecondary, 'high', log)

    // Sem secondary → 4 degraus no total (push, whatsapp, sms, call)
    for (let step = 0; step < 4; step++) {
      const dels = await getDeliveries(incidentId)
      const latest = dels[dels.length - 1]
      if (!latest) break
      await expireDeadline(latest.id)
      await tickLadder(log)
    }

    const finalStatus = await getIncidentStatus(incidentId)
    assert(finalStatus === 'expired', `escada esgotada → expired (got ${finalStatus})`)

    const allDeliveries = await getDeliveries(incidentId)
    assert(allDeliveries.length === 4, `4 tentativas (got ${allDeliveries.length})`)

    const channels = allDeliveries.map((d) => d.channel)
    assert(
      channels.join(',') === 'push,whatsapp,sms,call',
      `canais em ordem: ${channels.join(',')}`,
    )

    const allTimedOut = allDeliveries
      .slice(0, -1)
      .every((d) => d.failure_reason === 'timeout_escalated')
    assert(allTimedOut, 'degraus anteriores marcados timeout_escalated')
  }

  // ── 6: Escada para se acknowledged ──
  console.log('\n== 6: Incidente acknowledged → escada para ==')
  {
    const incidentId = await createIncident(familyId, protectedId)
    await startLadder(incidentId, protectedId, 'high', log)

    // Simular ack
    await db
      .from('incidents')
      .update({ status: 'acknowledged' })
      .eq('id', incidentId)

    const deliveries = await getDeliveries(incidentId)
    await expireDeadline(deliveries[0]!.id)

    await tickLadder(log)

    const after = await getDeliveries(incidentId)
    assert(
      after.length === 1,
      `acknowledged → escada parada (deliveries=${after.length})`,
    )
  }

  // ── 7: Severidades diferentes → timeouts proporcionais ──
  console.log('\n== 7: Severidades com timeouts diferentes ==')
  {
    const ladder = getLadderDefinition()
    const criticalTimeout = ladder[0]!.escalation_seconds.critical
    const lowTimeout = ladder[0]!.escalation_seconds.low
    assert(
      criticalTimeout < lowTimeout,
      `critical (${criticalTimeout}s) < low (${lowTimeout}s)`,
    )

    const critIncident = await createIncident(familyId, protectedId, 'critical')
    await startLadder(critIncident, protectedId, 'critical', log)

    const lowIncident = await createIncident(familyId, protectedId, 'low')
    await startLadder(lowIncident, protectedId, 'low', log)

    const critDels = await getDeliveries(critIncident)
    const lowDels = await getDeliveries(lowIncident)

    const critDeadline = new Date(critDels[0]!.escalation_deadline!).getTime()
    const lowDeadline = new Date(lowDels[0]!.escalation_deadline!).getTime()
    assert(
      critDeadline < lowDeadline,
      'critical deadline mais curto que low deadline',
    )
  }

  // ── 8: Sem secundário → pula secondary, expire após 4 ──
  console.log('\n== 8: Sem 2º guardião → expire após 4 degraus primary ==')
  {
    const incidentId = await createIncident(familyId, protectedIdNoSecondary)
    await startLadder(incidentId, protectedIdNoSecondary, 'medium', log)

    let lastStatus = ''
    for (let step = 0; step < 10; step++) {
      const dels = await getDeliveries(incidentId)
      const latest = dels[dels.length - 1]
      if (!latest) break

      lastStatus = await getIncidentStatus(incidentId)
      if (lastStatus === 'expired') break

      await expireDeadline(latest.id)
      await tickLadder(log)
    }

    const finalStatus = await getIncidentStatus(incidentId)
    assert(finalStatus === 'expired', `sem secondary → expired (got ${finalStatus})`)

    const allDels = await getDeliveries(incidentId)
    const hasSecondary = allDels.some(
      (d) => d.target_guardian_id !== GUARDIAN_ID,
    )
    assert(!hasSecondary, 'nenhum degrau enviado para secondary')
    assert(allDels.length === 4, `exatamente 4 degraus (got ${allDels.length})`)
  }

  // ── Cleanup ──
  for (const id of cleanupIncidents) {
    await db.from('incident_deliveries').delete().eq('incident_id', id)
    await db.from('incidents').delete().eq('id', id)
  }

  console.log(`\nresumo: ${passes} ok, ${failures} fail`)
  if (failures > 0) process.exit(1)
  console.log('\n✓ smoke test da escada de entrega passou')
}

main().catch((err) => {
  console.error('smoke test falhou:', err)
  process.exit(1)
})
