import type { IncidentQueueMessage, Severity } from '@combinado/shared'
import type { Logger } from '../shared/logging/index.js'
import { orchestratorDb as db } from '../shared/db/roles.js'

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 }

const OPEN_STATUSES = ['open', 'notifying', 'escalated'] as const

export interface UpsertResult {
  incident_id: string
  created: boolean
  reopened: boolean
  severity: Severity
  previous_severity?: Severity
}

export async function upsertIncident(
  msg: IncidentQueueMessage,
  log: Logger,
): Promise<UpsertResult> {
  // Buscar incidente aberto para o mesmo protegido + contato
  const { data: existing, error: findErr } = await db
    .from('incidents')
    .select('id, severity, status')
    .eq('family_id', msg.family_id)
    .eq('protected_person_id', msg.protected_person_id)
    .eq('source_contact', msg.sender_jid)
    .in('status', [...OPEN_STATUSES])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findErr) {
    throw new Error(`buscar incidente existente falhou: ${findErr.message}`)
  }

  if (existing) {
    return await groupIntoExisting(existing, msg, log)
  }

  // Verificar se existe um incidente recém-confirmado para o mesmo contato.
  // Se sim, reabrir em vez de criar novo — novo sinal invalida o ack anterior.
  const { data: acked, error: ackedErr } = await db
    .from('incidents')
    .select('id, severity, status')
    .eq('family_id', msg.family_id)
    .eq('protected_person_id', msg.protected_person_id)
    .eq('source_contact', msg.sender_jid)
    .eq('status', 'acknowledged')
    .order('acknowledged_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ackedErr) {
    throw new Error(`buscar incidente acknowledged falhou: ${ackedErr.message}`)
  }

  if (acked) {
    return await reopenIncident(acked, msg, log)
  }

  return await createNew(msg, log)
}

async function groupIntoExisting(
  existing: { id: string; severity: string; status: string },
  msg: IncidentQueueMessage,
  log: Logger,
): Promise<UpsertResult> {
  const currentSeverity = existing.severity as Severity
  const newSeverity = msg.severity as Severity
  const shouldUpgrade = SEVERITY_RANK[newSeverity] > SEVERITY_RANK[currentSeverity]

  // Upgrade de severidade se o novo evento é mais grave
  if (shouldUpgrade) {
    const { error: updateErr } = await db
      .from('incidents')
      .update({ severity: newSeverity })
      .eq('id', existing.id)

    if (updateErr) {
      throw new Error(`upgrade severidade falhou: ${updateErr.message}`)
    }

    log.info('incidente agrupado com upgrade', {
      incident_id: existing.id,
      risk_event_id: msg.risk_event_id,
      previous_severity: currentSeverity,
      new_severity: newSeverity,
    })
  } else {
    log.info('incidente agrupado sem upgrade', {
      incident_id: existing.id,
      risk_event_id: msg.risk_event_id,
      severity: currentSeverity,
    })
  }

  // Vincular o risk_event ao incidente existente
  await linkRiskEvent(msg.risk_event_id, existing.id)

  return {
    incident_id: existing.id,
    created: false,
    reopened: false,
    severity: shouldUpgrade ? newSeverity : currentSeverity,
    previous_severity: shouldUpgrade ? currentSeverity : undefined,
  }
}

async function createNew(
  msg: IncidentQueueMessage,
  log: Logger,
): Promise<UpsertResult> {
  const summary = buildSummary(msg)

  const { data: incident, error: insertErr } = await db
    .from('incidents')
    .insert({
      family_id: msg.family_id,
      protected_person_id: msg.protected_person_id,
      status: 'open',
      severity: msg.severity,
      source_contact: msg.sender_jid,
      summary,
    })
    .select('id')
    .single()

  if (insertErr) {
    throw new Error(`criar incidente falhou: ${insertErr.message}`)
  }

  log.info('incidente criado', {
    incident_id: incident.id,
    risk_event_id: msg.risk_event_id,
    severity: msg.severity,
    decision: msg.decision,
  })

  // Vincular o risk_event ao novo incidente
  await linkRiskEvent(msg.risk_event_id, incident.id)

  return {
    incident_id: incident.id,
    created: true,
    reopened: false,
    severity: msg.severity as Severity,
  }
}

async function reopenIncident(
  acked: { id: string; severity: string; status: string },
  msg: IncidentQueueMessage,
  log: Logger,
): Promise<UpsertResult> {
  const currentSeverity = acked.severity as Severity
  const newSeverity = msg.severity as Severity
  const shouldUpgrade = SEVERITY_RANK[newSeverity] > SEVERITY_RANK[currentSeverity]
  const finalSeverity = shouldUpgrade ? newSeverity : currentSeverity

  const { error: updateErr } = await db
    .from('incidents')
    .update({
      status: 'open',
      severity: finalSeverity,
      acknowledged_at: null,
      acknowledged_by: null,
    })
    .eq('id', acked.id)

  if (updateErr) {
    throw new Error(`reabrir incidente falhou: ${updateErr.message}`)
  }

  await linkRiskEvent(msg.risk_event_id, acked.id)

  log.info('incidente reaberto por novo sinal', {
    incident_id: acked.id,
    risk_event_id: msg.risk_event_id,
    previous_severity: currentSeverity,
    new_severity: finalSeverity,
  })

  return {
    incident_id: acked.id,
    created: false,
    reopened: true,
    severity: finalSeverity,
    previous_severity: shouldUpgrade ? currentSeverity : undefined,
  }
}

async function linkRiskEvent(riskEventId: string, incidentId: string): Promise<void> {
  const { error } = await db
    .from('risk_events')
    .update({ incident_id: incidentId })
    .eq('id', riskEventId)

  if (error) {
    throw new Error(`vincular risk_event ao incidente falhou: ${error.message}`)
  }
}

function buildSummary(msg: IncidentQueueMessage): string {
  const activeSignals = Object.entries(msg.signals)
    .filter(([, v]) => v === true)
    .map(([k]) => k)
  return `${msg.decision}/${msg.severity}: ${activeSignals.join(', ')}`
}
