import type { DeliveryChannel, Severity } from '@combinado/shared'
import type { Logger } from '../../shared/logging/index.js'
import { db } from '../../shared/db/index.js'
import { dispatcher } from './dispatch.js'
import { recordDispatchFailure } from './telemetry.js'
import type { ProtocolResult } from '../channels/index.js'

export type ProtocolSendFn = (
  protectedPhone: string,
  protectedName: string,
  incidentId: string,
  log: Logger,
) => Promise<ProtocolResult>

let protocolSendFn: ProtocolSendFn | null = null

export function registerProtocolSender(fn: ProtocolSendFn): void {
  protocolSendFn = fn
}

// ── Definição da escada ─────────────────────────────────────────────────────
// Cada degrau tem canal, alvo (primário ou secundário) e tempo de escalação
// por severidade. A escada avança sozinha se ninguém confirma dentro da janela.

interface LadderStepDef {
  channel: DeliveryChannel
  target: 'primary' | 'secondary'
  escalation_seconds: Record<Severity, number>
}

const LADDER: LadderStepDef[] = [
  { channel: 'push',     target: 'primary',   escalation_seconds: { critical: 60,  high: 120, medium: 180, low: 300 } },
  { channel: 'whatsapp', target: 'primary',   escalation_seconds: { critical: 120, high: 180, medium: 300, low: 600 } },
  { channel: 'sms',      target: 'primary',   escalation_seconds: { critical: 120, high: 180, medium: 300, low: 600 } },
  { channel: 'call',     target: 'primary',   escalation_seconds: { critical: 180, high: 300, medium: 600, low: 900 } },
  { channel: 'push',     target: 'secondary', escalation_seconds: { critical: 60,  high: 120, medium: 180, low: 300 } },
  { channel: 'whatsapp', target: 'secondary', escalation_seconds: { critical: 120, high: 180, medium: 300, low: 600 } },
]

export function ladderLength(): number {
  return LADDER.length
}

export function primaryStepCount(): number {
  return LADDER.filter((s) => s.target === 'primary').length
}

// ── Guardiões ───────────────────────────────────────────────────────────────

interface GuardianInfo {
  guardian_id: string
  phone: string | null
}

interface GuardianSet {
  primary: GuardianInfo | null
  secondary: GuardianInfo | null
}

async function findGuardians(
  protectedPersonId: string,
): Promise<GuardianSet> {
  const { data, error } = await db
    .from('guardian_links')
    .select('guardian_id, role')
    .eq('protected_person_id', protectedPersonId)
    .in('role', ['primary', 'secondary'])

  if (error || !data) return { primary: null, secondary: null }

  const result: GuardianSet = { primary: null, secondary: null }

  for (const link of data) {
    const { data: guardian } = await db
      .from('guardians')
      .select('id, phone')
      .eq('id', link.guardian_id)
      .single()

    if (guardian) {
      const info: GuardianInfo = { guardian_id: guardian.id, phone: guardian.phone ?? null }
      if (link.role === 'primary') result.primary = info
      else if (link.role === 'secondary') result.secondary = info
    }
  }

  return result
}

// ── Start: primeiro degrau da escada ────────────────────────────────────────

export async function startLadder(
  incidentId: string,
  protectedPersonId: string,
  severity: Severity,
  log: Logger,
): Promise<void> {
  const guardians = await findGuardians(protectedPersonId)

  if (!guardians.primary) {
    log.error('ladder: nenhum guardião primário para iniciar escada', {
      incident_id: incidentId,
      protected_person_id: protectedPersonId,
    })
    await db
      .from('incidents')
      .update({ status: 'expired' })
      .eq('id', incidentId)
    return
  }

  // Enviar protocolo ao protegido antes de alertar os guardiões.
  // O protocolo é fire-and-forget: se falhar, a escada continua —
  // o fallback é o guardião ligar e orientar pessoalmente.
  await sendProtocolToProtected(incidentId, protectedPersonId, log)

  await createStep(incidentId, 0, guardians, severity, log)

  await db
    .from('incidents')
    .update({ status: 'notifying' })
    .eq('id', incidentId)

  log.info('ladder: escada iniciada', {
    incident_id: incidentId,
    severity,
    first_channel: LADDER[0]!.channel,
  })
}

async function sendProtocolToProtected(
  incidentId: string,
  protectedPersonId: string,
  log: Logger,
): Promise<void> {
  if (!protocolSendFn) {
    log.debug('ladder: protocol sender não registrado, pulando envio de protocolo')
    return
  }

  const { data: person } = await db
    .from('protected_persons')
    .select('phone, display_name')
    .eq('id', protectedPersonId)
    .single()

  if (!person?.phone) {
    log.warn('ladder: protegido sem telefone, protocolo não enviado', {
      incident_id: incidentId,
      protected_person_id: protectedPersonId,
    })
    return
  }

  const result = await protocolSendFn(
    person.phone,
    person.display_name,
    incidentId,
    log,
  )

  if (result.sent) {
    log.info('ladder: protocolo enviado ao protegido', {
      incident_id: incidentId,
      message_id: result.messageId ?? null,
    })
  } else {
    log.warn('ladder: falha ao enviar protocolo ao protegido — escada continua', {
      incident_id: incidentId,
      error: result.error,
    })
  }
}

// ── Tick: verificar prazos expirados e avançar ──────────────────────────────

export async function tickLadder(log: Logger): Promise<number> {
  const now = new Date().toISOString()

  const { data: incidents, error } = await db
    .from('incidents')
    .select('id, protected_person_id, severity, status')
    .in('status', ['notifying', 'escalated'])

  if (error || !incidents || incidents.length === 0) return 0

  let advanced = 0

  for (const incident of incidents) {
    const { data: latestDelivery } = await db
      .from('incident_deliveries')
      .select('id, step_order, escalation_deadline, acknowledged_at, failure_reason')
      .eq('incident_id', incident.id)
      .order('step_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latestDelivery) continue
    if (latestDelivery.acknowledged_at) continue
    if (!latestDelivery.escalation_deadline) continue
    if (latestDelivery.escalation_deadline > now) continue

    const nextStepOrder = latestDelivery.step_order + 1

    await db
      .from('incident_deliveries')
      .update({ failure_reason: 'timeout_escalated' })
      .eq('id', latestDelivery.id)

    const guardians = await findGuardians(incident.protected_person_id)
    const severity = incident.severity as Severity

    const created = await createStep(incident.id, nextStepOrder, guardians, severity, log)

    if (created) {
      const stepDef = LADDER[nextStepOrder]
      if (stepDef && stepDef.target === 'secondary' && incident.status !== 'escalated') {
        await db
          .from('incidents')
          .update({ status: 'escalated' })
          .eq('id', incident.id)
        log.info('ladder: incidente escalado para 2º guardião', {
          incident_id: incident.id,
        })
      }
      advanced++
    } else {
      await db
        .from('incidents')
        .update({ status: 'expired' })
        .eq('id', incident.id)
      log.warn('ladder: escada esgotada — sem confirmação', {
        incident_id: incident.id,
        last_step: latestDelivery.step_order,
      })
      advanced++
    }
  }

  return advanced
}

// ── Criar um degrau (step) ──────────────────────────────────────────────────

async function createStep(
  incidentId: string,
  stepOrder: number,
  guardians: GuardianSet,
  severity: Severity,
  log: Logger,
): Promise<boolean> {
  const stepDef = findNextValidStep(stepOrder, guardians)
  if (!stepDef) return false

  const guardian = stepDef.def.target === 'primary'
    ? guardians.primary!
    : guardians.secondary!

  const deadlineSeconds = stepDef.def.escalation_seconds[severity]
  const now = new Date()
  const deadline = new Date(now.getTime() + deadlineSeconds * 1000).toISOString()

  const { data: delivery, error: insertErr } = await db
    .from('incident_deliveries')
    .insert({
      incident_id: incidentId,
      channel: stepDef.def.channel,
      target_guardian_id: guardian.guardian_id,
      target_phone: guardian.phone,
      step_order: stepDef.index,
      sent_at: now.toISOString(),
      escalation_deadline: deadline,
    })
    .select('id')
    .single()

  if (insertErr || !delivery) {
    log.error('ladder: falha ao criar delivery step', {
      incident_id: incidentId,
      step_order: stepDef.index,
      error: insertErr?.message,
    })
    return false
  }

  const result = await dispatcher.send(
    stepDef.def.channel,
    { guardian_id: guardian.guardian_id, phone: guardian.phone },
    incidentId,
    log,
  )

  if (!result.sent) {
    const reason = `dispatch_failed: ${result.error ?? 'unknown'}`
    await recordDispatchFailure(delivery.id, reason, log)
    log.warn('ladder: dispatch falhou, tentando próximo degrau', {
      incident_id: incidentId,
      step_order: stepDef.index,
      channel: stepDef.def.channel,
      error: result.error,
    })
    return createStep(incidentId, stepDef.index + 1, guardians, severity, log)
  }

  log.info('ladder: degrau criado e enviado', {
    incident_id: incidentId,
    delivery_id: delivery.id,
    step_order: stepDef.index,
    channel: stepDef.def.channel,
    target: stepDef.def.target,
    deadline_seconds: deadlineSeconds,
  })

  return true
}

function findNextValidStep(
  fromIndex: number,
  guardians: GuardianSet,
): { def: LadderStepDef; index: number } | null {
  for (let i = fromIndex; i < LADDER.length; i++) {
    const def = LADDER[i]!
    if (def.target === 'secondary' && !guardians.secondary) continue
    return { def, index: i }
  }
  return null
}

// ── Helpers para testes ─────────────────────────────────────────────────────

export function getLadderDefinition(): readonly LadderStepDef[] {
  return LADDER
}
