import type { Context, Next } from 'hono'
import { createHmac } from 'node:crypto'
import { config } from '../../shared/config/index.js'

export async function whatsappSignature(c: Context, next: Next) {
  const appSecret = config.WHATSAPP_APP_SECRET
  if (!appSecret) {
    return c.json({ error: 'WhatsApp app secret not configured' }, 500)
  }

  const signature = c.req.header('x-hub-signature-256')
  if (!signature) {
    return c.json({ error: 'Missing X-Hub-Signature-256' }, 403)
  }

  const rawBody = await c.req.text()
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')

  if (signature !== expected) {
    return c.json({ error: 'Invalid WhatsApp signature' }, 403)
  }

  ;(c.req as unknown as Record<string, unknown>)._whatsappBody = JSON.parse(rawBody)
  await next()
}

export function getWhatsappBody(c: Context): Record<string, unknown> {
  return (c.req as unknown as Record<string, unknown>)._whatsappBody as Record<string, unknown>
}
