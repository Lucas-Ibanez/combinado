// Smoke test do classificador estreito (T6.3).
//
// Verifica:
//   1. Score coerente: mais sinais → score mais alto
//   2. Score em [0, 1] para qualquer combinação
//   3. Caso neutro (sem sinais) → score 0
//   4. Golpe clássico (todos os sinais) → score alto (~1.0)
//   5. Casos intermediários recebem score intermediário
//   6. Interface Classifier é respeitada (score + version)
//   7. Performance: milhares de classificações em milissegundos
//
// Rodar: pnpm --filter @combinado/service test:classifier
import { randomUUID } from 'node:crypto'
import type { MinimalEvent, RiskSignals } from '@combinado/shared'
import { classifier, WeightedSumClassifier } from '../src/risk/classifier/index.js'

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
// Bloco 1 — Caso neutro: nenhum sinal → score 0
// ---------------------------------------------------------------------------
console.log('\n== caso neutro ==')
{
  const result = classifier.classify(makeEvent({}))
  assert(result.score === 0, `score=0 para nenhum sinal (got ${result.score})`)
  assert(typeof result.version === 'string' && result.version.length > 0, `version presente: ${result.version}`)
}

// ---------------------------------------------------------------------------
// Bloco 2 — Sinal isolado: score baixo
// ---------------------------------------------------------------------------
console.log('\n== sinais isolados ==')
{
  const pix = classifier.classify(makeEvent({ pix_mention: true }))
  assert(pix.score > 0 && pix.score < 0.5, `pix sozinho: score=${pix.score.toFixed(2)} (baixo, não alto)`)

  const urgency = classifier.classify(makeEvent({ urgency_language: true }))
  assert(urgency.score > 0 && urgency.score < 0.5, `urgency sozinho: score=${urgency.score.toFixed(2)}`)

  const voice = classifier.classify(makeEvent({ voice_note: true }))
  assert(voice.score > 0 && voice.score < 0.5, `voice sozinho: score=${voice.score.toFixed(2)}`)
}

// ---------------------------------------------------------------------------
// Bloco 3 — Dois sinais: score intermediário
// ---------------------------------------------------------------------------
console.log('\n== dois sinais (intermediário) ==')
{
  const result = classifier.classify(makeEvent({
    pix_mention: true,
    urgency_language: true,
  }))
  assert(result.score >= 0.3 && result.score <= 0.7, `pix+urgency: score=${result.score.toFixed(2)} (intermediário)`)
}
{
  const result = classifier.classify(makeEvent({
    impersonation_pattern: true,
    unknown_sender: true,
  }))
  assert(result.score >= 0.2 && result.score <= 0.6, `impersonation+unknown: score=${result.score.toFixed(2)}`)
}

// ---------------------------------------------------------------------------
// Bloco 4 — Três sinais: score elevado
// ---------------------------------------------------------------------------
console.log('\n== três sinais (elevado) ==')
{
  const result = classifier.classify(makeEvent({
    pix_mention: true,
    urgency_language: true,
    impersonation_pattern: true,
  }))
  assert(result.score >= 0.5, `pix+urgency+impersonation: score=${result.score.toFixed(2)} (≥0.5)`)
}

// ---------------------------------------------------------------------------
// Bloco 5 — Todos os sinais: score alto (~1.0)
// ---------------------------------------------------------------------------
console.log('\n== todos os sinais (alto) ==')
{
  const result = classifier.classify(makeEvent({
    pix_mention: true,
    urgency_language: true,
    impersonation_pattern: true,
    secrecy_demand: true,
    device_excuse: true,
    unknown_sender: true,
    voice_note: true,
    link_suspicious: true,
    forwarded: true,
  }))
  assert(result.score >= 0.9, `todos sinais: score=${result.score.toFixed(2)} (≥0.9)`)
  assert(result.score <= 1.0, `score clamped ≤1.0 (got ${result.score})`)
}

// ---------------------------------------------------------------------------
// Bloco 6 — Monotonicidade: mais sinais → score ≥ anterior
// ---------------------------------------------------------------------------
console.log('\n== monotonicidade ==')
{
  const s1 = classifier.classify(makeEvent({ pix_mention: true })).score
  const s2 = classifier.classify(makeEvent({ pix_mention: true, urgency_language: true })).score
  const s3 = classifier.classify(makeEvent({
    pix_mention: true, urgency_language: true, impersonation_pattern: true,
  })).score
  const s4 = classifier.classify(makeEvent({
    pix_mention: true, urgency_language: true, impersonation_pattern: true,
    secrecy_demand: true,
  })).score

  assert(s2 > s1, `s2=${s2.toFixed(2)} > s1=${s1.toFixed(2)}`)
  assert(s3 > s2, `s3=${s3.toFixed(2)} > s2=${s2.toFixed(2)}`)
  assert(s4 > s3, `s4=${s4.toFixed(2)} > s3=${s3.toFixed(2)}`)
}

// ---------------------------------------------------------------------------
// Bloco 7 — Score sempre em [0, 1]
// ---------------------------------------------------------------------------
console.log('\n== bounds [0, 1] ==')
{
  // Testa com sinais desconhecidos (index signature) — não devem quebrar
  const eventWeird = makeEvent({ some_future_signal: true, another: true })
  const result = classifier.classify(eventWeird)
  assert(result.score >= 0 && result.score <= 1, `sinais desconhecidos: score=${result.score.toFixed(2)} em [0,1]`)
}

// ---------------------------------------------------------------------------
// Bloco 8 — Interface: instância via classe e singleton exportado
// ---------------------------------------------------------------------------
console.log('\n== interface ==')
{
  const manual = new WeightedSumClassifier()
  const r = manual.classify(makeEvent({ pix_mention: true }))
  assert(typeof r.score === 'number', 'score é número')
  assert(typeof r.version === 'string', 'version é string')
  assert(r.version.includes('weighted-sum'), `version contém "weighted-sum": ${r.version}`)
}

// ---------------------------------------------------------------------------
// Bloco 9 — Performance: 10000 classificações
// ---------------------------------------------------------------------------
console.log('\n== performance ==')
{
  const event = makeEvent({
    pix_mention: true,
    urgency_language: true,
    impersonation_pattern: true,
    unknown_sender: true,
  })
  const t0 = performance.now()
  for (let i = 0; i < 10_000; i++) classifier.classify(event)
  const elapsed = performance.now() - t0
  assert(elapsed < 50, `10000 classificações em ${elapsed.toFixed(1)}ms (< 50ms)`)
}

console.log(`\nresumo: ${passes} ok, ${failures} fail`)
if (failures > 0) process.exit(1)
console.log('\n✓ smoke test do classificador estreito passou')
