import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { config } from '../shared/config/index.js'
import type { Logger } from '../shared/logging/index.js'
import { twilioStatusRoutes } from './routes/twilio-status.js'
import { whatsappWebhookRoutes } from './routes/whatsapp-webhook.js'

export interface HttpHandle {
  stop(): Promise<void>
}

export function startHttpServer(log: Logger): HttpHandle {
  const app = new Hono()

  app.get('/health', (c) => c.json({ ok: true }))

  app.route('/webhooks/twilio', twilioStatusRoutes(log))
  app.route('/webhooks/whatsapp', whatsappWebhookRoutes(log))

  app.notFound((c) => c.json({ error: 'Not found' }, 404))

  app.onError((err, c) => {
    log.error('http erro não tratado', {
      path: c.req.path,
      error_name: err.name,
      error_detail: err.message?.slice(0, 200),
    })
    return c.json({ error: 'Internal server error' }, 500)
  })

  const port = config.WEBHOOK_PORT

  const server = serve({ fetch: app.fetch, port }, () => {
    log.info('http server online', { port })
  })

  return {
    stop() {
      return new Promise<void>((resolve, reject) => {
        server.close((err: Error | undefined) => (err ? reject(err) : resolve()))
      })
    },
  }
}
