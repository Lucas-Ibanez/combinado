import type { Logger } from '../shared/logging/index.js'
import { orchestratorDb as db } from '../shared/db/roles.js'
import { recordAcknowledgment } from './ladder/telemetry.js'
import { sendPostAckConfirmation } from './post-ack.js'

const ACKABLE_STATUSES = ['notifying', 'escalated'] as const

export interface AckResult {
  success: boolean
  reason?: 'not_found' | 'already_acknowledged' | 'wrong_status' | 'db_error'
}

export async function acknowledgeIncident(
  incidentId: string,
  guardianId: string,
  log: Logger,
  ackAction: string = 'safe_confirmed',
): Promise<AckResult> {
  const { data: incident, error: findErr } = await db
    .from('incidents')
    .select('id, status')
    .eq('id', incidentId)
    .maybeSingle()

  if (findErr) {
    log.error('ack: falha ao buscar incidente', {
      incident_id: incidentId,
      error: findErr.message,
    })
    return { success: false, reason: 'db_error' }
  }

  if (!incident) {
    return { success: false, reason: 'not_found' }
  }

  if (incident.status === 'acknowledged' || incident.status === 'closed') {
    return { success: false, reason: 'already_acknowledged' }
  }

  if (!ACKABLE_STATUSES.includes(incident.status as any)) {
    return { success: false, reason: 'wrong_status' }
  }

  const now = new Date().toISOString()

  const { error: updateErr } = await db
    .from('incidents')
    .update({
      status: 'acknowledged',
      acknowledged_at: now,
      acknowledged_by: guardianId,
    })
    .eq('id', incidentId)
    .in('status', [...ACKABLE_STATUSES])

  if (updateErr) {
    log.error('ack: falha ao atualizar incidente', {
      incident_id: incidentId,
      error: updateErr.message,
    })
    return { success: false, reason: 'db_error' }
  }

  const { data: activeDelivery } = await db
    .from('incident_deliveries')
    .select('id')
    .eq('incident_id', incidentId)
    .is('acknowledged_at', null)
    .is('failure_reason', null)
    .order('step_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeDelivery) {
    await recordAcknowledgment(activeDelivery.id, guardianId, log)
  }

  log.info('ack: incidente confirmado', {
    incident_id: incidentId,
    guardian_id: guardianId,
    delivery_acked: activeDelivery?.id ?? null,
    ack_action: ackAction,
  })

  // Confirmação fora do canal comprometido: envia resultado ao protegido
  // via SMS/ligação (canais independentes do WhatsApp suspeito).
  // Fire-and-forget: falha aqui não invalida o ack já gravado.
  sendPostAckConfirmation(incidentId, guardianId, ackAction, log).catch((err) => {
    log.error('post-ack: falha ao enviar confirmação ao protegido', {
      incident_id: incidentId,
      error: (err as Error).message,
    })
  })

  return { success: true }
}
