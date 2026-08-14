import type { Logger } from '../../shared/logging/index.js'
import type { DispatchTarget, DispatchResult } from '../ladder/dispatch.js'
import { config } from '../../shared/config/index.js'

// web-push não tem @types — tipagem mínima inline
// eslint-disable-next-line @typescript-eslint/no-require-imports
import webpush from 'web-push'

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

function isValidSubscription(sub: unknown): sub is PushSubscription {
  if (!sub || typeof sub !== 'object') return false
  const s = sub as Record<string, unknown>
  if (typeof s.endpoint !== 'string' || !s.endpoint) return false
  if (!s.keys || typeof s.keys !== 'object') return false
  const keys = s.keys as Record<string, unknown>
  return typeof keys.p256dh === 'string' && typeof keys.auth === 'string'
}

export class PushChannel {
  async send(
    target: DispatchTarget,
    incidentId: string,
    log: Logger,
  ): Promise<DispatchResult> {
    if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) {
      log.warn('push-channel: VAPID não configurado', {
        incident_id: incidentId,
      })
      return { sent: false, error: 'vapid_not_configured' }
    }

    if (!isValidSubscription(target.push_subscription)) {
      log.warn('push-channel: sem push_subscription válida', {
        incident_id: incidentId,
        guardian_id: target.guardian_id,
      })
      return { sent: false, error: 'no_push_subscription' }
    }

    webpush.setVapidDetails(
      'mailto:suporte@combinado.app',
      config.VAPID_PUBLIC_KEY,
      config.VAPID_PRIVATE_KEY,
    )

    const payload = JSON.stringify({
      title: 'Alerta Combinado',
      body: 'Mensagem suspeita detectada. Abra o app para verificar.',
      data: { incident_id: incidentId },
      tag: `incident-${incidentId}`,
    })

    try {
      await webpush.sendNotification(target.push_subscription, payload)

      log.info('push-channel: notificação enviada', {
        incident_id: incidentId,
        guardian_id: target.guardian_id,
      })

      return { sent: true }
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      log.error('push-channel: falha ao enviar push', {
        incident_id: incidentId,
        guardian_id: target.guardian_id,
        status_code: statusCode,
        error_message: (err as Error).message,
      })
      return { sent: false, error: (err as Error).message }
    }
  }
}

export { isValidSubscription as _isValidSubscriptionForTest }
