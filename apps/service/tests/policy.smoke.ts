// Smoke test da política determinística (T6.5).
//
// Verifica que a decisão é REPRODUZÍVEL (mesma entrada → mesma saída) e
// EXPLICÁVEL (reasons não-vazio). Cobre os caminhos:
//   A) Short-circuit (regras critical/high)
//   B) Classificador alto → block
//   C) Classificador médio + LLM upgrade/downgrade
//   D) Classificador baixo + piso de regras
//   E) Fallback safety (LLM indisponível)
//   F) Reprodutibilidade (10.000 execuções idênticas)
//
// Rodar: pnpm --filter @combinado/service test:policy
import { evaluatePolicy } from '../src/risk/policy/index.js'
import type { RuleResult, ClassifierResult, LlmResult, PolicyResult } from '@combinado/shared'

let passes = 0, failures = 0
function assert(cond: unknown, msg: string): void {
  if (cond) { passes += 1; console.log(`[ok]   ${msg}`) }
  else { failures += 1; console.error(`[fail] ${msg}`) }
}

// Helpers para construir inputs de teste
function makeRules(overrides: Partial<RuleResult> = {}): RuleResult {
  return {
    decision: 'allow',
    severity: 'low',
    triggered_rules: [],
    short_circuit: false,
    ...overrides,
  }
}

function makeClassifier(score: number): ClassifierResult {
  return { score, version: 'weighted-sum-v1' }
}

function makeLlm(overrides: Partial<LlmResult> = {}): LlmResult {
  return {
    assessment: null,
    used_fallback: true,
    model: 'nvidia/nemotron-3-ultra-550b-a55b',
    prompt_version: 'v1-nemotron-ultra',
    latency_ms: 0,
    ...overrides,
  }
}

function makeLlmReal(
  risk: 'low' | 'medium' | 'high',
  confidence: number,
): LlmResult {
  return {
    assessment: { risk_assessment: risk, confidence, reasoning: 'teste' },
    used_fallback: false,
    model: 'nvidia/nemotron-3-ultra-550b-a55b',
    prompt_version: 'v1-nemotron-ultra',
    latency_ms: 500,
  }
}

function main() {
  // ── A: short-circuit (regras critical) ──
  console.log('\n== A: short-circuit (regras critical) ==')
  {
    const result = evaluatePolicy({
      rules: makeRules({
        decision: 'block',
        severity: 'critical',
        triggered_rules: ['impersonation_money_urgency'],
        short_circuit: true,
      }),
      classifier: makeClassifier(0.85),
      llm: makeLlm(),
    })
    assert(result.decision === 'block', `critical → block (got ${result.decision})`)
    assert(result.severity === 'critical', `critical severity mantida (got ${result.severity})`)
    assert(result.reasons.length > 0, `reasons explicam: ${result.reasons[0]}`)
  }

  console.log('\n== A2: short-circuit (regras high) ==')
  {
    const result = evaluatePolicy({
      rules: makeRules({
        decision: 'block',
        severity: 'high',
        triggered_rules: ['money_urgency'],
        short_circuit: true,
      }),
      classifier: makeClassifier(0.5),
      llm: makeLlm(),
    })
    assert(result.decision === 'block', `high → block (got ${result.decision})`)
    assert(result.severity === 'high', `high severity mantida (got ${result.severity})`)
  }

  // ── B: classificador alto → block ──
  console.log('\n== B: classificador alto → block ==')
  {
    const result = evaluatePolicy({
      rules: makeRules(),
      classifier: makeClassifier(0.75),
      llm: makeLlmReal('high', 0.9),
    })
    assert(result.decision === 'block', `score=0.75 → block (got ${result.decision})`)
    assert(result.severity === 'high', `severity=high (got ${result.severity})`)
  }

  // ── C: classificador médio + LLM upgrade ──
  console.log('\n== C1: classificador médio + LLM upgrade (high conf) ==')
  {
    const result = evaluatePolicy({
      rules: makeRules(),
      classifier: makeClassifier(0.50),
      llm: makeLlmReal('high', 0.85),
    })
    assert(result.decision === 'block', `review + LLM high → block (got ${result.decision})`)
    assert(result.reasons.some(r => r.includes('upgrade')), 'reason menciona upgrade')
  }

  console.log('\n== C2: classificador médio + LLM downgrade (low conf alta) ==')
  {
    const result = evaluatePolicy({
      rules: makeRules(),
      classifier: makeClassifier(0.45),
      llm: makeLlmReal('low', 0.90),
    })
    assert(result.decision === 'allow', `review + LLM low conf=0.90 → allow (got ${result.decision})`)
    assert(result.reasons.some(r => r.includes('downgrade')), 'reason menciona downgrade')
  }

  console.log('\n== C3: classificador médio + LLM sem ajuste (medium) ==')
  {
    const result = evaluatePolicy({
      rules: makeRules(),
      classifier: makeClassifier(0.50),
      llm: makeLlmReal('medium', 0.60),
    })
    assert(result.decision === 'review', `review + LLM medium → review (got ${result.decision})`)
  }

  console.log('\n== C4: LLM high mas confiança baixa → sem upgrade ==')
  {
    const result = evaluatePolicy({
      rules: makeRules(),
      classifier: makeClassifier(0.50),
      llm: makeLlmReal('high', 0.50),
    })
    assert(result.decision === 'review', `LLM high conf=0.50 < 0.70 → sem upgrade (got ${result.decision})`)
  }

  // ── D: classificador baixo + piso de regras ──
  console.log('\n== D: classificador baixo + regras medium → piso review ==')
  {
    const result = evaluatePolicy({
      rules: makeRules({
        decision: 'review',
        severity: 'medium',
        triggered_rules: ['impersonation_urgency'],
      }),
      classifier: makeClassifier(0.20),
      llm: makeLlmReal('low', 0.90),
    })
    assert(result.decision === 'review', `piso de regras impede allow (got ${result.decision})`)
    assert(result.reasons.some(r => r.includes('piso')), 'reason menciona piso de regras')
  }

  // ── E: fallback safety ──
  console.log('\n== E: LLM fallback + classifier ≥ threshold → mínimo review ==')
  {
    const result = evaluatePolicy({
      rules: makeRules(),
      classifier: makeClassifier(0.45),
      llm: makeLlm(),
    })
    assert(result.decision === 'review', `fallback + score=0.45 → review (got ${result.decision})`)
  }

  console.log('\n== E2: LLM fallback + classifier baixo → allow OK ==')
  {
    const result = evaluatePolicy({
      rules: makeRules(),
      classifier: makeClassifier(0.10),
      llm: makeLlm(),
    })
    assert(result.decision === 'allow', `fallback + score=0.10 → allow (got ${result.decision})`)
  }

  // ── F: reprodutibilidade ──
  console.log('\n== F: reprodutibilidade (10.000 execuções) ==')
  {
    const input = {
      rules: makeRules({
        triggered_rules: ['impersonation_urgency'],
        decision: 'review' as const,
        severity: 'medium' as const,
      }),
      classifier: makeClassifier(0.55),
      llm: makeLlmReal('high', 0.80),
    }

    const baseline = evaluatePolicy(input)
    let allMatch = true
    const t0 = performance.now()

    for (let i = 0; i < 10_000; i++) {
      const r = evaluatePolicy(input)
      if (
        r.decision !== baseline.decision ||
        r.severity !== baseline.severity ||
        r.reasons.join('|') !== baseline.reasons.join('|')
      ) {
        allMatch = false
        break
      }
    }

    const elapsed = (performance.now() - t0).toFixed(1)
    assert(allMatch, `10.000 execuções idênticas → ${baseline.decision}/${baseline.severity}`)
    assert(Number(elapsed) < 100, `10.000 execuções em ${elapsed}ms (< 100ms)`)
    console.log(`[info] decisão baseline: ${baseline.decision}/${baseline.severity}`)
    console.log(`[info] reasons: ${JSON.stringify(baseline.reasons)}`)
  }

  // ── G: todas as decisões têm reasons ──
  console.log('\n== G: reasons sempre presentes ==')
  {
    const scenarios: Array<{ label: string; result: PolicyResult }> = [
      {
        label: 'short-circuit critical',
        result: evaluatePolicy({
          rules: makeRules({ decision: 'block', severity: 'critical', triggered_rules: ['r1'], short_circuit: true }),
          classifier: makeClassifier(0),
          llm: makeLlm(),
        }),
      },
      {
        label: 'classifier low + no rules',
        result: evaluatePolicy({
          rules: makeRules(),
          classifier: makeClassifier(0.05),
          llm: makeLlmReal('low', 0.95),
        }),
      },
      {
        label: 'classifier high + LLM high',
        result: evaluatePolicy({
          rules: makeRules(),
          classifier: makeClassifier(0.80),
          llm: makeLlmReal('high', 0.95),
        }),
      },
    ]

    for (const { label, result } of scenarios) {
      assert(
        result.reasons.length > 0,
        `"${label}" tem ${result.reasons.length} reason(s)`,
      )
    }
  }

  // ── H: severidade de regras prevalece se maior ──
  console.log('\n== H: severidade de regras prevalece quando maior ==')
  {
    const result = evaluatePolicy({
      rules: makeRules({
        decision: 'review',
        severity: 'medium',
        triggered_rules: ['impersonation_urgency'],
      }),
      classifier: makeClassifier(0.20),
      llm: makeLlmReal('medium', 0.60),
    })
    assert(result.severity === 'medium', `regra medium prevalece sobre low (got ${result.severity})`)
  }

  console.log(`\nresumo: ${passes} ok, ${failures} fail`)
  if (failures > 0) process.exit(1)
  console.log('\n✓ smoke test da política determinística passou')
}

main()
