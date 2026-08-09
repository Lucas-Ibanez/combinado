import type { Context, Next } from 'hono'
import { validateRequest } from 'twilio/lib/webhooks/webhooks.js'
import { config } from '../../shared/config/index.js'

export async function twilioSignature(c: Context, next: Next) {
  const authToken = config.TWILIO_AUTH_TOKEN
  if (!authToken) {
    return c.json({ error: 'Twilio auth token not configured' }, 500)
  }

  const signature = c.req.header('x-twilio-signature')
  if (!signature) {
    return c.json({ error: 'Missing X-Twilio-Signature' }, 403)
  }

  const url = new URL(c.req.url)
  const fullUrl = `${c.req.header('x-forwarded-proto') ?? url.protocol.replace(':', '')}://${c.req.header('x-forwarded-host') ?? url.host}${url.pathname}`

  const body = await c.req.parseBody()
  const params: Record<string, string> = {}
  for (const [k, v] of Object.entries(body)) {
    params[k] = String(v)
  }

  const valid = validateRequest(authToken, signature, fullUrl, params)
  if (!valid) {
    return c.json({ error: 'Invalid Twilio signature' }, 403)
  }

  ;(c.req as unknown as Record<string, unknown>)._twilioParams = params
  await next()
}

export function getTwilioParams(c: Context): Record<string, string> {
  return (c.req as unknown as Record<string, unknown>)._twilioParams as Record<string, string>
}
