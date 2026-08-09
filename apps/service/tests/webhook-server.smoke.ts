import { Hono } from 'hono'
import { createHmac } from 'node:crypto'
import { getExpectedTwilioSignature } from 'twilio/lib/webhooks/webhooks.js'

const TWILIO_AUTH_TOKEN = 'test-auth-token-for-smoke'
const WHATSAPP_APP_SECRET = 'test-whatsapp-secret'
const WHATSAPP_VERIFY_TOKEN = 'test-verify-token'

// Override config before importing server modules
process.env.TWILIO_AUTH_TOKEN = TWILIO_AUTH_TOKEN
process.env.WHATSAPP_APP_SECRET = WHATSAPP_APP_SECRET
process.env.WHATSAPP_VERIFY_TOKEN = WHATSAPP_VERIFY_TOKEN

const { twilioSignature, getTwilioParams } = await import('../src/http/middleware/twilio-signature.js')
const { whatsappSignature, getWhatsappBody } = await import('../src/http/middleware/whatsapp-signature.js')

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

// ---------------------------------------------------------------------------
// Build test apps with the middleware directly
// ---------------------------------------------------------------------------
function buildTwilioApp() {
  const app = new Hono()
  app.post('/test', twilioSignature, (c) => c.json({ ok: true }))
  return app
}

function buildWhatsappApp() {
  const app = new Hono()
  app.get('/test', (c) => {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    const challenge = c.req.query('hub.challenge')
    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      return c.text(challenge ?? '', 200)
    }
    return c.text('Forbidden', 403)
  })
  app.post('/test', whatsappSignature, (c) => c.json({ ok: true }))
  return app
}

// ---------------------------------------------------------------------------
// Twilio signature tests
// ---------------------------------------------------------------------------
console.log('\n=== Twilio Signature Middleware ===\n')

const twilioApp = buildTwilioApp()

{
  // Test 1: reject without signature
  const res = await twilioApp.request('/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'MessageSid=SM123&MessageStatus=delivered',
  })
  assert(res.status === 403, 'rejects request without X-Twilio-Signature')
  const body = await res.json() as { error: string }
  assert(body.error === 'Missing X-Twilio-Signature', 'error message is correct')
}

{
  // Test 2: reject with wrong signature
  const res = await twilioApp.request('/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Twilio-Signature': 'invalid-signature',
    },
    body: 'MessageSid=SM123&MessageStatus=delivered',
  })
  assert(res.status === 403, 'rejects request with invalid signature')
  const body = await res.json() as { error: string }
  assert(body.error === 'Invalid Twilio signature', 'error says invalid signature')
}

{
  // Test 3: accept with valid signature
  const url = 'http://localhost/test'
  const params = { MessageSid: 'SM123', MessageStatus: 'delivered' }
  const validSignature = getExpectedTwilioSignature(TWILIO_AUTH_TOKEN, url, params)

  const res = await twilioApp.request('/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Twilio-Signature': validSignature,
    },
    body: 'MessageSid=SM123&MessageStatus=delivered',
  })
  assert(res.status === 200, 'accepts request with valid Twilio signature')
  const body = await res.json() as { ok: boolean }
  assert(body.ok === true, 'handler returns ok: true')
}

// ---------------------------------------------------------------------------
// WhatsApp signature tests
// ---------------------------------------------------------------------------
console.log('\n=== WhatsApp Signature Middleware ===\n')

const whatsappApp = buildWhatsappApp()

{
  // Test 4: verify token (GET challenge)
  const res = await whatsappApp.request(
    '/test?hub.mode=subscribe&hub.verify_token=' + WHATSAPP_VERIFY_TOKEN + '&hub.challenge=test-challenge-123',
  )
  assert(res.status === 200, 'GET verification returns 200')
  const text = await res.text()
  assert(text === 'test-challenge-123', 'returns the challenge token')
}

{
  // Test 5: reject wrong verify token
  const res = await whatsappApp.request(
    '/test?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=x',
  )
  assert(res.status === 403, 'rejects wrong verify token')
}

{
  // Test 6: reject POST without signature
  const res = await whatsappApp.request('/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry: [] }),
  })
  assert(res.status === 403, 'rejects POST without X-Hub-Signature-256')
}

{
  // Test 7: reject POST with wrong signature
  const res = await whatsappApp.request('/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': 'sha256=invalid',
    },
    body: JSON.stringify({ entry: [] }),
  })
  assert(res.status === 403, 'rejects POST with invalid signature')
}

{
  // Test 8: accept POST with valid signature
  const payload = JSON.stringify({
    entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.123', status: 'delivered', recipient_id: '5511999' }] } }] }],
  })
  const hash = createHmac('sha256', WHATSAPP_APP_SECRET).update(payload).digest('hex')

  const res = await whatsappApp.request('/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': `sha256=${hash}`,
    },
    body: payload,
  })
  assert(res.status === 200, 'accepts POST with valid WhatsApp signature')
  const body = await res.json() as { ok: boolean }
  assert(body.ok === true, 'handler returns ok: true')
}

// ---------------------------------------------------------------------------
// Health endpoint test
// ---------------------------------------------------------------------------
console.log('\n=== Health Endpoint ===\n')

{
  const { startHttpServer } = await import('../src/http/index.js')
  const { createLogger } = await import('../src/shared/logging/index.js')

  const log = createLogger('test')
  const handle = startHttpServer(log)

  // Wait a tick for server to bind
  await new Promise((r) => setTimeout(r, 100))

  const port = Number(process.env.WEBHOOK_PORT ?? 3100)
  const res = await fetch(`http://localhost:${port}/health`)
  assert(res.status === 200, 'GET /health returns 200')
  const body = await res.json() as { ok: boolean }
  assert(body.ok === true, '/health returns { ok: true }')

  // Test 404 for unknown routes
  const res404 = await fetch(`http://localhost:${port}/nonexistent`)
  assert(res404.status === 404, 'unknown route returns 404')

  await handle.stop()
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(50)}`)
console.log(`Resultado: ${passed} passaram, ${failed} falharam de ${passed + failed}`)
if (failed > 0) process.exit(1)
console.log('Todos os testes passaram!\n')
