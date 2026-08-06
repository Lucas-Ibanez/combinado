// Sanitização defensiva do meta antes de logar.
// A REGRA de ouro no código do serviço é: nunca passe conteúdo/telefone/email
// pro logger. Este módulo é uma segunda linha de defesa — se um dev
// acidentalmente vazar um campo perigoso, o valor sai como [REDACTED] no log.

// Nomes de campo que redigimos por completo. Casamos por lowercase e por
// "contém" — mensagem, message, MessageText, message_text, etc.
const REDACT_KEY_PATTERNS = [
  'content',
  'body',
  'text',
  'message',
  'msg_body',
  'raw',
  'transcript',
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'session_key',
  'cookie',
  'email',
]

// Nomes de campo cujo VALOR é telefone. Aqui não redigimos por completo —
// mascaramos mantendo só os últimos 4 dígitos, útil pra rastrear sem expor.
const PHONE_KEY_PATTERNS = ['phone', 'phone_number', 'msisdn', 'jid', 'from', 'to']

// Detector de telefone em string livre — só captura formato E.164 com +
// (ex.: +5511987654321). Sem o +, um UUID com dígitos consecutivos poderia
// dar falso positivo. A defesa primária é o nome de campo (PHONE_KEY_PATTERNS);
// isso aqui é rede pra telefone escondido em texto livre.
const PHONE_REGEX = /\+\d{10,15}/g

// Detector de e-mail para o mesmo motivo.
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g

const REDACTED = '[REDACTED]'
const MAX_DEPTH = 5

function keyMatches(key: string, patterns: string[]): boolean {
  const k = key.toLowerCase()
  return patterns.some((p) => k.includes(p))
}

function maskPhoneString(value: string): string {
  // Preserva últimos 4 dígitos, mascara o resto: "+5511987654321" -> "***4321"
  const digits = value.replace(/\D/g, '')
  if (digits.length < 4) return REDACTED
  return `***${digits.slice(-4)}`
}

function scrubStringValue(value: string): string {
  let out = value
  out = out.replace(PHONE_REGEX, (m) => maskPhoneString(m))
  out = out.replace(EMAIL_REGEX, REDACTED)
  return out
}

export function redact(input: unknown, depth = 0): unknown {
  if (input === null || input === undefined) return input
  if (depth > MAX_DEPTH) return '[TRUNCATED]'

  if (typeof input === 'string') {
    return scrubStringValue(input)
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return input
  }

  if (Array.isArray(input)) {
    return input.map((v) => redact(v, depth + 1))
  }

  if (typeof input === 'object') {
    const src = input as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(src)) {
      if (keyMatches(key, REDACT_KEY_PATTERNS)) {
        out[key] = REDACTED
        continue
      }
      if (keyMatches(key, PHONE_KEY_PATTERNS)) {
        out[key] = typeof val === 'string' ? maskPhoneString(val) : REDACTED
        continue
      }
      out[key] = redact(val, depth + 1)
    }
    return out
  }

  // funções, symbols, bigints — jogamos fora
  return undefined
}
