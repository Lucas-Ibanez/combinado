import type { Logger } from '../../shared/logging/index.js'
import { orchestratorDb as db } from '../../shared/db/roles.js'

// ── Timeline: histórico completo de tentativas de um incidente ──────────────

export interface DeliveryRecord {
  id: string
  incident_id: string
  channel: string
  target_guardian_id: string | null
  target_phone: string | null
  step_order: number
  sent_at: string | null
  delivered_at: string | null
  acknowledged_at: string | null
  acknowledged_by: string | null
  failure_reason: string | null
  escalation_deadline: string | null
  created_at: string
}

export async function getIncidentTimeline(
  incidentId: string,
): Promise<DeliveryRecord[]> {
  const { data, error } = await db
    .from('incident_deliveries')
    .select(
      'id, incident_id, channel, target_guardian_id, target_phone, ' +
      'step_order, sent_at, delivered_at, acknowledged_at, acknowledged_by, ' +
      'failure_reason, escalation_deadline, created_at',
    )
    .eq('incident_id', incidentId)
    .order('step_order', { ascending: true })

  if (error) throw new Error(`timeline query falhou: ${error.message}`)
  return (data ?? []) as unknown as DeliveryRecord[]
}

// ── Delivery confirmation: canal confirmou que a mensagem chegou ────────────

export async function recordDelivered(
  deliveryId: string,
  log: Logger,
): Promise<boolean> {
  const { error } = await db
    .from('incident_deliveries')
    .update({ delivered_at: new Date().toISOString() })
    .eq('id', deliveryId)
    .is('delivered_at', null)

  if (error) {
    log.error('telemetry: falha ao registrar delivered_at', {
      delivery_id: deliveryId,
      error: error.message,
    })
    return false
  }

  log.info('telemetry: entrega confirmada', { delivery_id: deliveryId })
  return true
}

// ── Acknowledgment: guardião confirmou que viu o alerta ─────────────────────

export async function recordAcknowledgment(
  deliveryId: string,
  guardianId: string,
  log: Logger,
): Promise<boolean> {
  const { error } = await db
    .from('incident_deliveries')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: guardianId,
    })
    .eq('id', deliveryId)
    .is('acknowledged_at', null)

  if (error) {
    log.error('telemetry: falha ao registrar acknowledgment', {
      delivery_id: deliveryId,
      guardian_id: guardianId,
      error: error.message,
    })
    return false
  }

  log.info('telemetry: alerta reconhecido', {
    delivery_id: deliveryId,
    guardian_id: guardianId,
  })
  return true
}

// ── Dispatch failure: canal falhou ao enviar ────────────────────────────────

export async function recordDispatchFailure(
  deliveryId: string,
  reason: string,
  log: Logger,
): Promise<void> {
  const { error } = await db
    .from('incident_deliveries')
    .update({ failure_reason: reason })
    .eq('id', deliveryId)

  if (error) {
    log.error('telemetry: falha ao registrar dispatch failure', {
      delivery_id: deliveryId,
      error: error.message,
    })
  }
}
