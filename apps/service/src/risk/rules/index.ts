import type { MinimalEvent, RuleResult, Severity } from '@combinado/shared'

interface Rule {
  name: string
  severity: Severity
  test: (event: MinimalEvent) => boolean
}

function s(event: MinimalEvent, key: string): boolean {
  return event.signals[key] === true
}

// Regras ordenadas da mais severa para a menos severa. A primeira que bater
// com short_circuit=true encerra o pipeline — para o caso óbvio, a ação sai
// imediatamente; a explicação do LLM (se houver) chega depois.
const rules: Rule[] = [
  // ── CRITICAL: golpe clássico de impersonação ──
  {
    name: 'impersonation_money_urgency',
    severity: 'critical',
    test: (e) => s(e, 'impersonation_pattern') && s(e, 'pix_mention') && s(e, 'urgency_language'),
  },
  {
    name: 'impersonation_money_secrecy',
    severity: 'critical',
    test: (e) => s(e, 'impersonation_pattern') && s(e, 'pix_mention') && s(e, 'secrecy_demand'),
  },
  {
    name: 'device_excuse_money_urgency',
    severity: 'critical',
    test: (e) => s(e, 'device_excuse') && s(e, 'pix_mention') && s(e, 'urgency_language'),
  },

  // ── HIGH: combinações fortes, mas falta um sinal para fechar ──
  {
    name: 'money_urgency',
    severity: 'high',
    test: (e) => s(e, 'pix_mention') && s(e, 'urgency_language'),
  },
  {
    name: 'impersonation_money',
    severity: 'high',
    test: (e) => s(e, 'impersonation_pattern') && s(e, 'pix_mention'),
  },
  {
    name: 'money_unknown_sender',
    severity: 'high',
    test: (e) => s(e, 'pix_mention') && s(e, 'unknown_sender'),
  },
  {
    name: 'impersonation_urgency_secrecy',
    severity: 'high',
    test: (e) => s(e, 'impersonation_pattern') && s(e, 'urgency_language') && s(e, 'secrecy_demand'),
  },
  {
    name: 'device_excuse_money',
    severity: 'high',
    test: (e) => s(e, 'device_excuse') && s(e, 'pix_mention'),
  },
  {
    name: 'secrecy_money',
    severity: 'high',
    test: (e) => s(e, 'secrecy_demand') && s(e, 'pix_mention'),
  },

  // ── MEDIUM: sinais isolados que merecem atenção ──
  {
    name: 'impersonation_urgency',
    severity: 'medium',
    test: (e) => s(e, 'impersonation_pattern') && s(e, 'urgency_language'),
  },
  {
    name: 'voice_unknown_sender',
    severity: 'medium',
    test: (e) => s(e, 'voice_note') && s(e, 'unknown_sender'),
  },
  {
    name: 'link_suspicious_urgency',
    severity: 'medium',
    test: (e) => s(e, 'link_suspicious') && s(e, 'urgency_language'),
  },
  {
    name: 'device_excuse_urgency',
    severity: 'medium',
    test: (e) => s(e, 'device_excuse') && s(e, 'urgency_language'),
  },
  {
    name: 'forwarded_money',
    severity: 'medium',
    test: (e) => s(e, 'forwarded') && s(e, 'pix_mention'),
  },
]

const SEVERITY_ORDER: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

const DECISION_BY_SEVERITY: Record<Severity, 'allow' | 'review' | 'block'> = {
  low: 'allow',
  medium: 'review',
  high: 'block',
  critical: 'block',
}

export function evaluateRules(event: MinimalEvent): RuleResult {
  const triggered: string[] = []
  let maxSeverity: Severity = 'low'

  for (const rule of rules) {
    if (rule.test(event)) {
      triggered.push(rule.name)
      if (SEVERITY_ORDER[rule.severity] > SEVERITY_ORDER[maxSeverity]) {
        maxSeverity = rule.severity
      }
    }
  }

  const shortCircuit = maxSeverity === 'critical' || maxSeverity === 'high'

  return {
    decision: triggered.length > 0 ? DECISION_BY_SEVERITY[maxSeverity] : 'allow',
    severity: maxSeverity,
    triggered_rules: triggered,
    short_circuit: shortCircuit,
  }
}
