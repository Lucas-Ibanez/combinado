import type { RiskSignals } from '@combinado/shared'

// Sinais determinísticos extraídos do texto (usado só localmente na normalize).
// Cada regex casa palavras em pt-BR comuns em tentativas de golpe.
// A regra dourada: nunca retornar o texto — só boolean.

const MONEY_PATTERNS = [
  /\bpix\b/i,
  /\br\$\s*\d/i, // R$ 100
  /\br\$\b/i,
  /\bdinheiro\b/i,
  /\breais?\b/i,
  /\btransfer[eê](?:r|ncia)?\b/i,
  /\bdeposit(?:o|ar|ada?|e)\b/i,
  /\bboleto\b/i,
  /\bcpf\b/i,
  /\bconta\s+banc[aá]ria\b/i,
  /\bpagament(?:o|os)\b/i,
]

const URGENCY_PATTERNS = [
  /\burgente\b/i,
  /\bagora\b/i,
  /\br[aá]pid(?:o|a|amente)\b/i,
  /\bemerg[eê]ncia\b/i,
  /\bimediat(?:o|a|amente)\b/i,
  /\bcorrend(?:o|a)\b/i,
  /\bhoje\s+ainda\b/i,
  /\bpra\s+ontem\b/i,
]

// Palavras de parentesco usadas pra se passar por familiar. NÃO indicam
// golpe por si só — combinadas com money+urgency é que o risco sobe.
const FAMILY_ROLE_PATTERNS = [
  /\bm[ãa]e\b/i,
  /\bpai\b/i,
  /\bfilh[oa]\b/i,
  /\bnet[oa]\b/i,
  /\bsobrinh[oa]\b/i,
  /\bti[oa]\b/i,
  /\bav[oó]\b/i,
  /\bv[oó]\b/i,
  /\birm[ãa]o?\b/i,
  /\bprim[oa]\b/i,
]

// Pedido de sigilo — golpista tenta isolar a vítima do círculo de confiança.
const SECRECY_PATTERNS = [
  /\bn[ãa]o\s+(?:ligue?|fal[ae]|cont[ae]|avis[ae])/i,
  /\bn[ãa]o\s+cont[ae]\s+(?:pra|para|a)\s+ningu[eé]m/i,
  /\bsegredo\b/i,
  /\bentre\s+n[oó]s\b/i,
  /\bsó\s+eu\s+e\s+voc[eê]\b/i,
]

// Desculpa de troca de aparelho/número — pretexto pra justificar número novo.
const DEVICE_EXCUSE_PATTERNS = [
  /\baparelh(?:o|inho)\s+(?:quebr|estrago|roub)/i,
  /\btroquei\s+(?:de\s+)?n[uú]mero/i,
  /\bcelular\s+(?:quebr|estrago|roub|novo)/i,
  /\bn[uú]mero\s+novo\b/i,
  /\bchip\s+novo\b/i,
  /\bperdi\s+(?:o\s+)?celular\b/i,
  /\btelefone\s+(?:quebr|estrago|roub|novo)/i,
]

// Domínios "encurtadores" e outros padrões suspeitos em URL.
// Não bloqueia por ter link — só sinaliza os encurtadores clássicos.
const SUSPICIOUS_LINK_PATTERNS = [
  /bit\.ly/i,
  /tinyurl\.com/i,
  /encurtador\./i,
  /is\.gd/i,
  /t\.co\//i,
  /goo\.gl/i,
  /shorturl/i,
  /ow\.ly/i,
]

function anyMatch(patterns: RegExp[], text: string): boolean {
  return patterns.some((re) => re.test(text))
}

export interface ComputeSignalsInput {
  text: string | null
  messageType:
    | 'text'
    | 'audio'
    | 'image'
    | 'video'
    | 'document'
    | 'sticker'
    | 'other'
}

export function computeSignals(input: ComputeSignalsInput): RiskSignals {
  const signals: RiskSignals = {}
  const t = input.text

  if (t) {
    if (anyMatch(MONEY_PATTERNS, t)) signals.pix_mention = true
    if (anyMatch(URGENCY_PATTERNS, t)) signals.urgency_language = true
    if (anyMatch(FAMILY_ROLE_PATTERNS, t)) signals.impersonation_pattern = true
    if (anyMatch(SUSPICIOUS_LINK_PATTERNS, t)) signals.link_suspicious = true
    if (anyMatch(SECRECY_PATTERNS, t)) signals.secrecy_demand = true
    if (anyMatch(DEVICE_EXCUSE_PATTERNS, t)) signals.device_excuse = true
  }

  if (input.messageType === 'audio') {
    // Áudio sempre carrega risco extra — é o vetor de voz clonada e
    // também é o preferido do golpista pra evitar filtros de texto.
    signals.voice_note = true
  }

  return signals
}
