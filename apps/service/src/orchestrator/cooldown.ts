import type { IncidentQueueMessage } from '@combinado/shared'
import type { Logger } from '../shared/logging/index.js'
import { db } from '../shared/db/index.js'

const COOLDOWN_WINDOW_MS = 5 * 60 * 1000

const lastProcessed = new Map<string, number>()

function contactKey(msg: IncidentQueueMessage): string {
  return `${msg.protected_person_id}:${msg.sender_jid}`
}

export interface SuppressionResult {
  suppressed: boolean
  reason?: 'dedup' | 'cooldown'
  existing_incident_id?: string
}

export async function checkSuppression(
  msg: IncidentQueueMessage,
  log: Logger,
): Promise<SuppressionResult> {
  // 1. Dedup: risk_event já foi vinculado a um incidente (reprocessamento)
  const { data: riskEvent } = await db
    .from('risk_events')
    .select('incident_id')
    .eq('id', msg.risk_event_id)
    .single()

  if (riskEvent?.incident_id) {
    log.info('dedup: risk_event já vinculado a incidente', {
      risk_event_id: msg.risk_event_id,
      incident_id: riskEvent.incident_id,
    })
    return { suppressed: true, reason: 'dedup', existing_incident_id: riskEvent.incident_id }
  }

  // 2. Cooldown: mesmo contato processado recentemente
  const key = contactKey(msg)
  const now = Date.now()
  const lastTs = lastProcessed.get(key)

  if (lastTs && (now - lastTs) < COOLDOWN_WINDOW_MS) {
    const remainingSec = Math.round((COOLDOWN_WINDOW_MS - (now - lastTs)) / 1000)
    log.info('cooldown: contato suprimido', {
      risk_event_id: msg.risk_event_id,
      sender_jid: msg.sender_jid,
      remaining_seconds: remainingSec,
    })
    return { suppressed: true, reason: 'cooldown' }
  }

  return { suppressed: false }
}

export function recordProcessed(msg: IncidentQueueMessage): void {
  const key = contactKey(msg)
  lastProcessed.set(key, Date.now())
  pruneIfNeeded()
}

export function cooldownWindowMs(): number {
  return COOLDOWN_WINDOW_MS
}

// Expõe para testes: limpar o state interno
export function _resetForTest(): void {
  lastProcessed.clear()
}

// Expõe para testes: injetar um timestamp no mapa
export function _setLastProcessed(msg: IncidentQueueMessage, ts: number): void {
  lastProcessed.set(contactKey(msg), ts)
}

function pruneIfNeeded(): void {
  if (lastProcessed.size <= 500) return
  const cutoff = Date.now() - COOLDOWN_WINDOW_MS
  for (const [k, ts] of lastProcessed) {
    if (ts < cutoff) lastProcessed.delete(k)
  }
}
