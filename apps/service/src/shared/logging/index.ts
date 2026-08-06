import { redact } from './redact.js'
import { config } from '../config/index.js'

// Logger estruturado em JSON — uma linha por evento, direto no stdout.
// A regra é: logue `id` e `tipo`; NUNCA conteúdo de mensagem, telefone
// completo, e-mail, texto bruto. O redact é rede de segurança, não desculpa.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogMeta = Record<string, unknown>

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

// Em produção mostramos info+; em dev/test, tudo.
const MIN_LEVEL: LogLevel = config.NODE_ENV === 'production' ? 'info' : 'debug'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL]
}

export interface Logger {
  debug(msg: string, meta?: LogMeta): void
  info(msg: string, meta?: LogMeta): void
  warn(msg: string, meta?: LogMeta): void
  error(msg: string, meta?: LogMeta): void
  child(bindings: LogMeta): Logger
}

function emit(level: LogLevel, module: string, msg: string, meta: LogMeta) {
  if (!shouldLog(level)) return
  const safeMeta = redact(meta) as LogMeta
  const line = {
    ts: new Date().toISOString(),
    level,
    module,
    msg,
    ...safeMeta,
  }
  const target = level === 'error' || level === 'warn' ? console.error : console.log
  target(JSON.stringify(line))
}

function makeLogger(module: string, bindings: LogMeta = {}): Logger {
  const merge = (meta?: LogMeta) => ({ ...bindings, ...(meta ?? {}) })
  return {
    debug: (msg, meta) => emit('debug', module, msg, merge(meta)),
    info: (msg, meta) => emit('info', module, msg, merge(meta)),
    warn: (msg, meta) => emit('warn', module, msg, merge(meta)),
    error: (msg, meta) => emit('error', module, msg, merge(meta)),
    child: (extra) => makeLogger(module, { ...bindings, ...extra }),
  }
}

// Cria um logger nomeado por módulo. Ex: createLogger('gateway'), createLogger('risk').
export function createLogger(module: string): Logger {
  return makeLogger(module)
}
