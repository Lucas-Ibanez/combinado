import type { RiskSignals, RiskDecision, Severity } from '@combinado/shared'
import { computeSignals } from '../gateway/normalize/signals.js'
import { evaluateRules } from '../risk/rules/index.js'
import { classifier } from '../risk/classifier/index.js'

export interface VerificationResult {
  risk_level: 'safe' | 'suspicious' | 'dangerous'
  severity: Severity
  decision: RiskDecision
  signals: RiskSignals
  triggered_rules: string[]
  classifier_score: number
  advice: string
}

const SIGNAL_LABELS: Record<string, string> = {
  pix_mention: 'Menção a Pix/dinheiro/transferência',
  urgency_language: 'Linguagem de urgência',
  impersonation_pattern: 'Menção a relação familiar',
  secrecy_demand: 'Pedido de sigilo',
  device_excuse: 'Desculpa de troca de aparelho',
  link_suspicious: 'Link encurtado suspeito',
  voice_note: 'Mensagem de áudio',
  unknown_sender: 'Remetente desconhecido',
  forwarded: 'Mensagem encaminhada',
}

function buildAdvice(result: {
  risk_level: string
  severity: Severity
  signals: RiskSignals
  triggered_rules: string[]
}): string {
  if (result.risk_level === 'dangerous') {
    const parts = ['*ALTO RISCO DE GOLPE*']
    parts.push('')
    parts.push('Esta mensagem apresenta padrões claros de golpe:')

    const activeSignals = Object.entries(result.signals)
      .filter(([, v]) => v === true)
      .map(([k]) => SIGNAL_LABELS[k] ?? k)
    for (const s of activeSignals) {
      parts.push(`  - ${s}`)
    }

    parts.push('')
    parts.push('*NÃO faça nenhuma transferência.*')
    parts.push('Peça a *senha combinada* antes de qualquer coisa.')
    parts.push('Se a pessoa não souber, *não transfira* e ligue para o familiar por outro meio.')
    return parts.join('\n')
  }

  if (result.risk_level === 'suspicious') {
    const parts = ['*ATENÇÃO: mensagem suspeita*']
    parts.push('')
    parts.push('Identifiquei alguns sinais que merecem cuidado:')

    const activeSignals = Object.entries(result.signals)
      .filter(([, v]) => v === true)
      .map(([k]) => SIGNAL_LABELS[k] ?? k)
    for (const s of activeSignals) {
      parts.push(`  - ${s}`)
    }

    parts.push('')
    parts.push(
      'Não identifiquei padrões claros de golpe, mas se há pedido de dinheiro, ' +
      '*peça a senha combinada mesmo assim*.',
    )
    parts.push('Na dúvida, ligue para o familiar por outro meio para confirmar.')
    return parts.join('\n')
  }

  return [
    'Não identifiquei padrões claros de golpe nesta mensagem.',
    '',
    'Mas lembre-se: se houver qualquer pedido de dinheiro ou transferência, ' +
    '*peça a senha combinada mesmo assim*.',
    '',
    '_O Combinado analisa padrões de texto, mas nenhuma ferramenta é infalível. ' +
    'Na dúvida, confirme por outro canal._',
  ].join('\n')
}

export function assessText(text: string): VerificationResult {
  const signals = computeSignals({ text, messageType: 'text' })

  const syntheticEvent = {
    event_id: 'verification',
    family_id: '',
    protected_person_id: '',
    sender_jid: '',
    message_type: 'text' as const,
    text_length: text.length,
    signals,
    captured_at: new Date().toISOString(),
    wa_timestamp: null,
  }

  const ruleResult = evaluateRules(syntheticEvent)
  const classifierResult = classifier.classify(syntheticEvent)

  let risk_level: 'safe' | 'suspicious' | 'dangerous'
  if (ruleResult.decision === 'block') {
    risk_level = 'dangerous'
  } else if (ruleResult.decision === 'review' || classifierResult.score >= 0.40) {
    risk_level = 'suspicious'
  } else {
    risk_level = 'safe'
  }

  const result = {
    risk_level,
    severity: ruleResult.severity,
    decision: ruleResult.decision,
    signals,
    triggered_rules: ruleResult.triggered_rules,
    classifier_score: classifierResult.score,
    advice: '',
  }

  result.advice = buildAdvice(result)
  return result
}
