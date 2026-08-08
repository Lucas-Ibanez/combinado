import type {
  RuleResult,
  ClassifierResult,
  LlmResult,
  PolicyResult,
  RiskDecision,
  Severity,
} from '@combinado/shared'

export interface PolicyInput {
  rules: RuleResult
  classifier: ClassifierResult
  llm: LlmResult
}

const CLASSIFIER_BLOCK_THRESHOLD = 0.70
const CLASSIFIER_REVIEW_THRESHOLD = 0.40
const LLM_UPGRADE_CONFIDENCE = 0.70
const LLM_DOWNGRADE_CONFIDENCE = 0.80

const DECISION_RANK: Record<RiskDecision, number> = { allow: 0, review: 1, block: 2 }
const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 }

function upgradeDecision(d: RiskDecision): RiskDecision {
  if (d === 'allow') return 'review'
  return 'block'
}

function downgradeDecision(d: RiskDecision): RiskDecision {
  if (d === 'block') return 'review'
  return 'allow'
}

function severityForDecision(d: RiskDecision): Severity {
  if (d === 'block') return 'high'
  if (d === 'review') return 'medium'
  return 'low'
}

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  const { rules, classifier, llm } = input
  const reasons: string[] = []

  // ── PATH A: short-circuit (regras já decidiram) ──
  if (rules.short_circuit) {
    reasons.push(
      `regras determinísticas: ${rules.triggered_rules.join(', ')} → ${rules.severity}/${rules.decision}`,
    )
    return { decision: rules.decision, severity: rules.severity, reasons }
  }

  // ── PATH B: decisão composta (classificador + LLM + regras) ──

  // Passo 1: base a partir do classificador
  let decision: RiskDecision
  if (classifier.score >= CLASSIFIER_BLOCK_THRESHOLD) {
    decision = 'block'
    reasons.push(`classificador score=${classifier.score.toFixed(2)} ≥ ${CLASSIFIER_BLOCK_THRESHOLD} → block`)
  } else if (classifier.score >= CLASSIFIER_REVIEW_THRESHOLD) {
    decision = 'review'
    reasons.push(`classificador score=${classifier.score.toFixed(2)} ≥ ${CLASSIFIER_REVIEW_THRESHOLD} → review`)
  } else {
    decision = 'allow'
    reasons.push(`classificador score=${classifier.score.toFixed(2)} < ${CLASSIFIER_REVIEW_THRESHOLD} → allow`)
  }

  // Passo 2: ajuste pelo LLM (se disponível)
  if (!llm.used_fallback && llm.assessment) {
    const { risk_assessment, confidence } = llm.assessment

    if (risk_assessment === 'high' && confidence >= LLM_UPGRADE_CONFIDENCE) {
      const prev = decision
      decision = upgradeDecision(decision)
      if (prev !== decision) {
        reasons.push(
          `LLM=${risk_assessment} conf=${confidence.toFixed(2)} ≥ ${LLM_UPGRADE_CONFIDENCE} → upgrade ${prev}→${decision}`,
        )
      }
    } else if (risk_assessment === 'low' && confidence >= LLM_DOWNGRADE_CONFIDENCE) {
      const prev = decision
      decision = downgradeDecision(decision)
      if (prev !== decision) {
        reasons.push(
          `LLM=${risk_assessment} conf=${confidence.toFixed(2)} ≥ ${LLM_DOWNGRADE_CONFIDENCE} → downgrade ${prev}→${decision}`,
        )
      }
    } else {
      reasons.push(`LLM=${risk_assessment} conf=${confidence.toFixed(2)} → sem ajuste`)
    }
  } else {
    reasons.push('LLM fallback — decisão mantida sem ajuste')
  }

  // Passo 3: piso de regras — se alguma regra medium disparou, garante ao menos review
  if (rules.triggered_rules.length > 0 && DECISION_RANK[decision] < DECISION_RANK['review']) {
    decision = 'review'
    reasons.push(
      `piso de regras: ${rules.triggered_rules.join(', ')} → mínimo review`,
    )
  }

  // Passo 4: segurança do fallback — se LLM caiu e classificador ≥ threshold, não desce abaixo de review
  if (llm.used_fallback && classifier.score >= CLASSIFIER_REVIEW_THRESHOLD && DECISION_RANK[decision] < DECISION_RANK['review']) {
    decision = 'review'
    reasons.push('fallback safety: LLM indisponível + classifier ≥ threshold → mínimo review')
  }

  const severity = severityForDecision(decision)

  // Se regras deram medium e a política resolveu algo mais alto, mantém a maior severidade
  if (SEVERITY_RANK[rules.severity] > SEVERITY_RANK[severity]) {
    return { decision, severity: rules.severity, reasons }
  }

  return { decision, severity, reasons }
}
