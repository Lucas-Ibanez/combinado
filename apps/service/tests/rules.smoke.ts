// Smoke test das regras determinísticas (T6.2).
//
// Verifica:
//   1. Golpe clássico (money+urgency+impersonation) → critical + block + short_circuit
//   2. Combinações fortes (2 sinais) → high + block + short_circuit
//   3. Combinações médias → medium + review + sem short_circuit
//   4. Texto neutro (sem sinais) → low + allow + sem short_circuit
//   5. Performance: todas as regras rodam em < 5ms
//   6. Novos sinais: secrecy_demand, device_excuse
//
// Rodar: pnpm --filter @combinado/service test:rules
import { randomUUID } from 'node:crypto'
import type { MinimalEvent, RiskSignals } from '@combinado/shared'
import { evaluateRules } from '../src/risk/rules/index.js'

let passes = 0, failures = 0
function assert(cond: unknown, msg: string): void {
  if (cond) { passes += 1; console.log(`[ok]   ${msg}`) }
  else { failures += 1; console.error(`[fail] ${msg}`) }
}

function makeEvent(signals: RiskSignals): MinimalEvent {
  return {
    event_id: `TEST_${Date.now()}`,
    family_id: randomUUID(),
    protected_person_id: randomUUID(),
    sender_jid: '5511999999999@s.whatsapp.net',
    message_type: 'text',
    text_length: 50,
    signals,
    captured_at: new Date().toISOString(),
    wa_timestamp: Math.floor(Date.now() / 1000),
  }
}

// ---------------------------------------------------------------------------
// Bloco 1 — Golpe clássico: impersonation + money + urgency = CRITICAL
// ---------------------------------------------------------------------------
console.log('\n== golpe clássico (critical) ==')
{
  const event = makeEvent({
    pix_mention: true,
    urgency_language: true,
    impersonation_pattern: true,
  })
  const t0 = performance.now()
  const result = evaluateRules(event)
  const elapsed = performance.now() - t0

  assert(result.severity === 'critical', `severity=critical (got ${result.severity})`)
  assert(result.decision === 'block', `decision=block (got ${result.decision})`)
  assert(result.short_circuit === true, 'short_circuit=true')
  assert(result.triggered_rules.includes('impersonation_money_urgency'), 'regra impersonation_money_urgency disparou')
  assert(elapsed < 5, `performance: ${elapsed.toFixed(2)}ms < 5ms`)
}

// ---------------------------------------------------------------------------
// Bloco 2 — Critical: device excuse + money + urgency
// ---------------------------------------------------------------------------
console.log('\n== device excuse + money + urgency (critical) ==')
{
  const result = evaluateRules(makeEvent({
    device_excuse: true,
    pix_mention: true,
    urgency_language: true,
  }))
  assert(result.severity === 'critical', `severity=critical (got ${result.severity})`)
  assert(result.triggered_rules.includes('device_excuse_money_urgency'), 'regra device_excuse_money_urgency disparou')
  assert(result.short_circuit === true, 'short_circuit=true')
}

// ---------------------------------------------------------------------------
// Bloco 3 — Critical: impersonation + money + secrecy
// ---------------------------------------------------------------------------
console.log('\n== impersonation + money + secrecy (critical) ==')
{
  const result = evaluateRules(makeEvent({
    impersonation_pattern: true,
    pix_mention: true,
    secrecy_demand: true,
  }))
  assert(result.severity === 'critical', `severity=critical (got ${result.severity})`)
  assert(result.triggered_rules.includes('impersonation_money_secrecy'), 'regra impersonation_money_secrecy disparou')
}

// ---------------------------------------------------------------------------
// Bloco 4 — HIGH: money + urgency (sem impersonation)
// ---------------------------------------------------------------------------
console.log('\n== money + urgency (high) ==')
{
  const result = evaluateRules(makeEvent({
    pix_mention: true,
    urgency_language: true,
  }))
  assert(result.severity === 'high', `severity=high (got ${result.severity})`)
  assert(result.decision === 'block', `decision=block (got ${result.decision})`)
  assert(result.short_circuit === true, 'short_circuit=true (high faz short-circuit)')
  assert(result.triggered_rules.includes('money_urgency'), 'regra money_urgency disparou')
}

// ---------------------------------------------------------------------------
// Bloco 5 — HIGH: money + unknown sender
// ---------------------------------------------------------------------------
console.log('\n== money + unknown sender (high) ==')
{
  const result = evaluateRules(makeEvent({
    pix_mention: true,
    unknown_sender: true,
  }))
  assert(result.severity === 'high', `severity=high (got ${result.severity})`)
  assert(result.triggered_rules.includes('money_unknown_sender'), 'regra money_unknown_sender disparou')
}

// ---------------------------------------------------------------------------
// Bloco 6 — HIGH: secrecy + money
// ---------------------------------------------------------------------------
console.log('\n== secrecy + money (high) ==')
{
  const result = evaluateRules(makeEvent({
    secrecy_demand: true,
    pix_mention: true,
  }))
  assert(result.severity === 'high', `severity=high (got ${result.severity})`)
  assert(result.triggered_rules.includes('secrecy_money'), 'regra secrecy_money disparou')
}

// ---------------------------------------------------------------------------
// Bloco 7 — MEDIUM: impersonation + urgency (sem money)
// ---------------------------------------------------------------------------
console.log('\n== impersonation + urgency (medium) ==')
{
  const result = evaluateRules(makeEvent({
    impersonation_pattern: true,
    urgency_language: true,
  }))
  assert(result.severity === 'medium', `severity=medium (got ${result.severity})`)
  assert(result.decision === 'review', `decision=review (got ${result.decision})`)
  assert(result.short_circuit === false, 'short_circuit=false (medium não curto-circuita)')
  assert(result.triggered_rules.includes('impersonation_urgency'), 'regra impersonation_urgency disparou')
}

// ---------------------------------------------------------------------------
// Bloco 8 — MEDIUM: voice + unknown sender
// ---------------------------------------------------------------------------
console.log('\n== voice + unknown sender (medium) ==')
{
  const result = evaluateRules(makeEvent({
    voice_note: true,
    unknown_sender: true,
  }))
  assert(result.severity === 'medium', `severity=medium (got ${result.severity})`)
  assert(result.triggered_rules.includes('voice_unknown_sender'), 'regra voice_unknown_sender disparou')
}

// ---------------------------------------------------------------------------
// Bloco 9 — MEDIUM: link suspeito + urgency
// ---------------------------------------------------------------------------
console.log('\n== link suspeito + urgency (medium) ==')
{
  const result = evaluateRules(makeEvent({
    link_suspicious: true,
    urgency_language: true,
  }))
  assert(result.severity === 'medium', `severity=medium (got ${result.severity})`)
  assert(result.triggered_rules.includes('link_suspicious_urgency'), 'regra link_suspicious_urgency disparou')
}

// ---------------------------------------------------------------------------
// Bloco 10 — LOW: nenhum sinal
// ---------------------------------------------------------------------------
console.log('\n== nenhum sinal (low) ==')
{
  const result = evaluateRules(makeEvent({}))
  assert(result.severity === 'low', `severity=low (got ${result.severity})`)
  assert(result.decision === 'allow', `decision=allow (got ${result.decision})`)
  assert(result.short_circuit === false, 'short_circuit=false')
  assert(result.triggered_rules.length === 0, 'nenhuma regra disparou')
}

// ---------------------------------------------------------------------------
// Bloco 11 — LOW: sinal isolado (só urgency, sem money/impersonation)
// ---------------------------------------------------------------------------
console.log('\n== sinal isolado (low) ==')
{
  const result = evaluateRules(makeEvent({ urgency_language: true }))
  assert(result.severity === 'low', `severity=low (got ${result.severity})`)
  assert(result.triggered_rules.length === 0, 'urgência sozinha não dispara regra')
}
{
  const result = evaluateRules(makeEvent({ pix_mention: true }))
  assert(result.severity === 'low', `severity=low (got ${result.severity})`)
  assert(result.triggered_rules.length === 0, 'pix sozinho não dispara regra')
}
{
  const result = evaluateRules(makeEvent({ impersonation_pattern: true }))
  assert(result.severity === 'low', `severity=low (got ${result.severity})`)
  assert(result.triggered_rules.length === 0, 'impersonation sozinho não dispara regra')
}

// ---------------------------------------------------------------------------
// Bloco 12 — Performance: 1000 avaliações em < 50ms
// ---------------------------------------------------------------------------
console.log('\n== performance: 1000 avaliações ==')
{
  const scamEvent = makeEvent({
    pix_mention: true,
    urgency_language: true,
    impersonation_pattern: true,
    secrecy_demand: true,
    device_excuse: true,
    voice_note: true,
    unknown_sender: true,
    link_suspicious: true,
    forwarded: true,
  })
  const t0 = performance.now()
  for (let i = 0; i < 1000; i++) evaluateRules(scamEvent)
  const elapsed = performance.now() - t0
  assert(elapsed < 50, `1000 avaliações em ${elapsed.toFixed(1)}ms (< 50ms)`)
}

// ---------------------------------------------------------------------------
// Bloco 13 — Múltiplas regras podem disparar simultaneamente
// ---------------------------------------------------------------------------
console.log('\n== múltiplas regras disparando ==')
{
  const result = evaluateRules(makeEvent({
    pix_mention: true,
    urgency_language: true,
    impersonation_pattern: true,
    secrecy_demand: true,
    device_excuse: true,
    unknown_sender: true,
  }))
  assert(result.triggered_rules.length > 3, `${result.triggered_rules.length} regras dispararam`)
  assert(result.severity === 'critical', 'severidade mais alta prevalece')
}

console.log(`\nresumo: ${passes} ok, ${failures} fail`)
if (failures > 0) process.exit(1)
console.log('\n✓ smoke test de regras determinísticas passou')
