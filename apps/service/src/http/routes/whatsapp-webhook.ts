import { Hono } from 'hono'
import { whatsappSignature, getWhatsappBody } from '../middleware/whatsapp-signature.js'
import { config } from '../../shared/config/index.js'
import type { Logger } from '../../shared/logging/index.js'

export function whatsappWebhookRoutes(log: Logger): Hono {
  const app = new Hono()

  app.get('/', (c) => {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    const challenge = c.req.query('hub.challenge')

    if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
      log.info('whatsapp webhook verificado')
      return c.text(challenge ?? '', 200)
    }

    return c.text('Forbidden', 403)
  })

  app.post('/', whatsappSignature, (c) => {
    const body = getWhatsappBody(c)

    const entries = (body.entry ?? []) as Array<Record<string, unknown>>
    for (const entry of entries) {
      const changes = (entry.changes ?? []) as Array<Record<string, unknown>>
      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined
        if (!value) continue

        const statuses = (value.statuses ?? []) as Array<Record<string, string>>
        for (const status of statuses) {
          log.info('whatsapp delivery status', {
            wa_message_id: status.id,
            status: status.status,
            recipient_id: status.recipient_id,
          })
        }
      }
    }

    return c.text('', 200)
  })

  return app
}
