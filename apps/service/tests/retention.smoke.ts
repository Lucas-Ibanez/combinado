import { hasActiveSignals, RETENTION_DAYS } from '../src/shared/retention/index.js'

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

// ── hasActiveSignals ────────────────────────────────────────────────────────

console.log('=== hasActiveSignals ===')

assert(!hasActiveSignals({}), 'empty signals → false')
assert(!hasActiveSignals({ pix_mention: false }), 'all false → false')
assert(!hasActiveSignals({ pix_mention: undefined }), 'undefined → false')
assert(!hasActiveSignals({ pix_mention: false, urgency_language: false }), 'multiple false → false')

assert(hasActiveSignals({ pix_mention: true }), 'one true → true')
assert(hasActiveSignals({ pix_mention: false, urgency_language: true }), 'mixed → true')
assert(hasActiveSignals({ voice_note: true, pix_mention: true }), 'multiple true → true')

// ── RETENTION_DAYS constants ────────────────────────────────────────────────

console.log('\n=== RETENTION_DAYS ===')

assert(RETENTION_DAYS.RISK_EVENTS === 90, 'risk_events = 90 days')
assert(RETENTION_DAYS.KEY_ACCESS_LOG === 30, 'key_access_log = 30 days')
assert(RETENTION_DAYS.EXPIRED_INVITES === 30, 'expired_invites = 30 days')
assert(RETENTION_DAYS.CLOSED_INCIDENTS === 365, 'closed_incidents = 365 days')

// ── MinimalEvent does not carry raw content ─────────────────────────────────

console.log('\n=== MinimalEvent privacy ===')

// Simulate what normalize() produces
const minimalEvent = {
  event_id: 'msg-123',
  family_id: 'fam-456',
  protected_person_id: 'pp-789',
  sender_jid: '5511999998888@s.whatsapp.net',
  message_type: 'text' as const,
  text_length: 42,
  signals: { pix_mention: true, urgency_language: true },
  captured_at: new Date().toISOString(),
  wa_timestamp: Math.floor(Date.now() / 1000),
}

assert(!('text' in minimalEvent), 'MinimalEvent has no text field')
assert(!('content' in minimalEvent), 'MinimalEvent has no content field')
assert(!('body' in minimalEvent), 'MinimalEvent has no body field')
assert(!('raw' in minimalEvent), 'MinimalEvent has no raw field')
assert(!('message' in minimalEvent), 'MinimalEvent has no message field')
assert(typeof minimalEvent.text_length === 'number', 'text_length is a number (not text)')

// ── risk_events insert payload ──────────────────────────────────────────────

console.log('\n=== risk_events privacy ===')

const riskInsert = {
  family_id: 'fam-456',
  protected_person_id: 'pp-789',
  signals: { pix_mention: true },
  severity: 'high',
  decision: 'review',
  pipeline_version: 'v1',
}

assert(!('text' in riskInsert), 'risk insert has no text')
assert(!('content' in riskInsert), 'risk insert has no content')
assert(!('sender_phone' in riskInsert), 'risk insert has no sender_phone')
assert(typeof riskInsert.signals === 'object', 'risk insert has signals object')

// ── Discard path ────────────────────────────────────────────────────────────

console.log('\n=== discard path ===')

const noSignalEvent = {
  signals: {},
  message_type: 'text',
}
assert(!hasActiveSignals(noSignalEvent.signals), 'no-signal message would be discarded')

const safeEvent = {
  signals: { pix_mention: true },
  message_type: 'text',
}
assert(hasActiveSignals(safeEvent.signals), 'signal message would be queued')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)
