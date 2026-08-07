import {
  makeWASocket,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WAMessage,
  type WASocket,
} from '@whiskeysockets/baileys'
import type { Logger } from '../../shared/logging/index.js'
import { loadAuthState } from './authState.js'

export interface BaileysHandle {
  stop(): Promise<void>
}

// Mensagem de entrada já filtrada — sem status, sem broadcast, não é do próprio
// protegido. Só o que interessa pro motor de risco.
export interface InboundMessage {
  raw: WAMessage
  remoteJid: string
  messageId: string
  timestamp: number | null
}

export interface BaileysCallbacks {
  onQr?: (qr: string) => void | Promise<void>
  onOpen?: (jid: string | null) => void | Promise<void>
  onLoggedOut?: () => void | Promise<void>
  onMessage?: (msg: InboundMessage) => void | Promise<void>
  // Se o telefone estiver bloqueando o QR ("não é possível conectar novos
  // dispositivos"), passe o número em E.164 sem + (ex.: '5511987654321') e
  // o Baileys usará o fluxo de código de pareamento em vez de QR. O código
  // chega aqui e você digita em "Vincular com número" no WhatsApp.
  onPairingCode?: (code: string) => void | Promise<void>
}

export interface BaileysConnectionOptions {
  // Se definido, tenta pareamento por código em vez de QR (quando não há
  // creds salvas). Formato: E.164 sem '+', só dígitos.
  pairingPhoneNumber?: string
}

// Backoff simples para reconexão. Se cair, tenta de novo com espera crescente
// até um teto — sem virar loop apertado que abusa da rede.
const RECONNECT_DELAYS_MS = [1_000, 3_000, 5_000, 10_000, 30_000]

// Silencia o pino interno do Baileys — nosso logger é a fonte de verdade.
const silentLogger: any = (() => {
  const noop = () => {}
  const l: any = {
    trace: noop, debug: noop, info: noop,
    warn: noop, error: noop, fatal: noop,
    level: 'silent',
  }
  l.child = () => l
  return l
})()

// Inicia uma conexão Baileys para UM protected_person. Cada conexão vive
// isolada em seu próprio keys dir, e as transições relevantes viram callbacks.
export async function startBaileysConnection(
  protectedPersonId: string,
  log: Logger,
  callbacks: BaileysCallbacks = {},
  options: BaileysConnectionOptions = {},
): Promise<BaileysHandle> {
  let stopped = false
  let sock: WASocket | null = null
  let reconnectAttempt = 0
  let currentTimer: NodeJS.Timeout | null = null

  async function connect(): Promise<void> {
    const { state, saveCreds } = await loadAuthState(protectedPersonId)
    const { version, isLatest } = await fetchLatestBaileysVersion()
    const hasCreds = !!state.creds?.me
    log.info('conectando ao WhatsApp', {
      has_saved_creds: hasCreds,
      attempt: reconnectAttempt,
      wa_version: version.join('.'),
      wa_version_is_latest: isLatest,
    })

    sock = makeWASocket({
      version,
      auth: state,
      // Identificador de browser mais neutro — o WhatsApp está bloqueando
      // strings customizadas em 2025. Ubuntu+Chrome é o combo menos filtrado.
      browser: Browsers.ubuntu('Chrome'),
      logger: silentLogger,
    })

    sock.ev.on('creds.update', saveCreds)

    // Pareamento por código de 8 dígitos — alternativa ao QR quando o
    // WhatsApp está bloqueando "novos dispositivos" (2025/2026).
    if (!hasCreds && options.pairingPhoneNumber && !sock.authState.creds.registered) {
      // Baileys quer um instante pra registrar o socket antes de aceitar o request
      setTimeout(async () => {
        try {
          const code = await sock!.requestPairingCode(options.pairingPhoneNumber!)
          log.info('código de pareamento gerado', { code_length: code.length })
          if (callbacks.onPairingCode) {
            void Promise.resolve(callbacks.onPairingCode(code)).catch((err) =>
              log.error('callback onPairingCode falhou', {
                error_name: (err as Error).name,
              }),
            )
          }
        } catch (err) {
          log.error('falha ao pedir pairing code', {
            error_name: (err as Error).name,
          })
        }
      }, 3_000)
    }

    sock.ev.on('messages.upsert', (payload) => {
      dispatchInbound(payload, callbacks.onMessage, (err) =>
        log.error('callback onMessage falhou', {
          error_name: err.name,
        }),
      )
    })

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr && callbacks.onQr) {
        void Promise.resolve(callbacks.onQr(qr)).catch((err) =>
          log.error('callback onQr falhou', { error_name: (err as Error).name }),
        )
      }

      if (connection === 'connecting') {
        log.debug('baileys connecting')
      }

      if (connection === 'open') {
        reconnectAttempt = 0
        const jid = sock?.user?.id ?? null
        log.info('baileys conexão OPEN', { jid: jid ? maskJid(jid) : null })
        if (callbacks.onOpen) {
          void Promise.resolve(callbacks.onOpen(jid)).catch((err) =>
            log.error('callback onOpen falhou', { error_name: (err as Error).name }),
          )
        }
      }

      if (connection === 'close') {
        // Duck typing sobre o erro Boom para não depender de package transitivo.
        const err = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode
        const loggedOut = err === DisconnectReason.loggedOut
        log.info('baileys conexão fechada', {
          logged_out: loggedOut,
          disconnect_code: err ?? null,
        })

        if (stopped) return

        if (loggedOut) {
          log.warn('sessão deslogada — apague o keys dir do protegido para reparear')
          if (callbacks.onLoggedOut) {
            void Promise.resolve(callbacks.onLoggedOut()).catch((cbErr) =>
              log.error('callback onLoggedOut falhou', {
                error_name: (cbErr as Error).name,
              }),
            )
          }
          return
        }

        scheduleReconnect()
      }
    })
  }

  function scheduleReconnect() {
    const idx = Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
    const delay = RECONNECT_DELAYS_MS[idx]!
    reconnectAttempt += 1
    log.info('reconectando em breve', { delay_ms: delay, next_attempt: reconnectAttempt })
    currentTimer = setTimeout(() => {
      if (stopped) return
      void connect().catch((err) => {
        log.error('falha ao reconectar', { error_name: (err as Error).name })
        scheduleReconnect()
      })
    }, delay)
  }

  await connect()

  return {
    async stop() {
      stopped = true
      if (currentTimer) clearTimeout(currentTimer)
      try {
        sock?.end(undefined)
      } catch {
        // já fechado — sem problema
      }
    },
  }
}

// Filtra mensagens que interessam ao motor de risco.
// Descarta: mensagens do próprio protegido (fromMe), status/broadcast, e
// mensagens de protocolo/vazias que o WhatsApp entrega mas não têm conteúdo
// endereçado ao protegido (revoke, receipts internos, senderKey distribution).
// Exportada para testes — a lógica não deve depender do socket.
export function filterInbound(raw: WAMessage): InboundMessage | null {
  const key = raw.key
  if (!key || !key.remoteJid || !key.id) return null
  if (key.fromMe) return null

  const jid = key.remoteJid
  if (jid === 'status@broadcast') return null
  if (jid.endsWith('@broadcast')) return null

  // Mensagens sem payload real (só protocolo) — nada pra classificar.
  const m = raw.message
  if (!m) return null
  const keysInPayload = Object.keys(m).filter((k) => (m as Record<string, unknown>)[k] != null)
  const protocolOnlyKey = keysInPayload.length === 1 && (
    keysInPayload[0] === 'protocolMessage' ||
    keysInPayload[0] === 'senderKeyDistributionMessage' ||
    keysInPayload[0] === 'reactionMessage' ||
    keysInPayload[0] === 'messageContextInfo'
  )
  if (protocolOnlyKey) return null
  if (keysInPayload.length === 0) return null

  return {
    raw,
    remoteJid: jid,
    messageId: key.id,
    timestamp:
      typeof raw.messageTimestamp === 'number'
        ? raw.messageTimestamp
        : raw.messageTimestamp?.toNumber?.() ?? null,
  }
}

// Dispatcher do evento messages.upsert — extraído puro para ser exercitado
// em teste sem subir o socket. Só chama onMessage para mensagens que passam
// no filtro E somente quando o tipo do batch é 'notify' (realtime).
export function dispatchInbound(
  payload: { messages: WAMessage[]; type: string },
  onMessage: ((msg: InboundMessage) => void | Promise<void>) | undefined,
  onCallbackError?: (err: Error) => void,
): void {
  // 'notify' = mensagem realtime chegando; 'append' seria sync histórico.
  // Só nos interessa realtime — o golpe chega ao vivo.
  if (payload.type !== 'notify') return
  for (const raw of payload.messages) {
    const filtered = filterInbound(raw)
    if (!filtered) continue
    if (onMessage) {
      // try/catch pega throw síncrono; Promise.resolve().catch pega rejeição async.
      try {
        const result = onMessage(filtered)
        if (result && typeof (result as Promise<void>).then === 'function') {
          void (result as Promise<void>).catch((err) => {
            if (onCallbackError) onCallbackError(err as Error)
          })
        }
      } catch (err) {
        if (onCallbackError) onCallbackError(err as Error)
      }
    }
  }
}

function maskJid(jid: string): string {
  const [user, domain] = jid.split('@')
  if (!user) return '[REDACTED]'
  const digits = user.replace(/\D/g, '')
  const tail = digits.length >= 4 ? `***${digits.slice(-4)}` : '[REDACTED]'
  return domain ? `${tail}@${domain}` : tail
}
