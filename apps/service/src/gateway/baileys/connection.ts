import {
  makeWASocket,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import type { Logger } from '../../shared/logging/index.js'
import { loadAuthState } from './authState.js'

export interface BaileysHandle {
  stop(): Promise<void>
}

// Backoff simples para reconexão. Se cair, tenta de novo com espera crescente
// até um teto — sem virar loop apertado que abusa da rede.
const RECONNECT_DELAYS_MS = [1_000, 3_000, 5_000, 10_000, 30_000]

// Silencia o pino interno do Baileys — nosso logger é a fonte de verdade.
// Interface mínima que o Baileys usa (compatível com pino).
const silentLogger: any = (() => {
  const noop = () => {}
  const l: any = {
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    level: 'silent',
  }
  l.child = () => l
  return l
})()

export async function startBaileysConnection(log: Logger): Promise<BaileysHandle> {
  let stopped = false
  let sock: WASocket | null = null
  let reconnectAttempt = 0
  let currentTimer: NodeJS.Timeout | null = null

  async function connect(): Promise<void> {
    const { state, saveCreds } = await loadAuthState()
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
      // printQRInTerminal foi descontinuado — cuidamos do QR abaixo.
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        log.info('QR de pareamento gerado — escaneie no WhatsApp do celular de teste')
        // Só em dev: imprime o QR no terminal. Em produção, isso vai para o app
        // do guardião via um job (T5.2).
        qrcode.generate(qr, { small: true })
      }

      if (connection === 'connecting') {
        log.debug('baileys connecting')
      }

      if (connection === 'open') {
        reconnectAttempt = 0
        log.info('baileys conexão OPEN', {
          jid: sock?.user?.id ? maskJid(sock.user.id) : null,
        })
      }

      if (connection === 'close') {
        // O erro do Baileys é um Boom — não importamos o tipo para não depender
        // de package transitivo; lemos statusCode com duck typing.
        const err = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode
        const loggedOut = err === DisconnectReason.loggedOut
        log.info('baileys conexão fechada', {
          logged_out: loggedOut,
          disconnect_code: err ?? null,
        })

        if (stopped || loggedOut) {
          if (loggedOut) {
            log.warn('sessão deslogada — remova apps/service/keys e refaça o pareamento')
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

// Trunca o JID (ex.: "5511987654321@s.whatsapp.net") mantendo só os últimos
// 4 dígitos + o domínio. Nunca logamos o número completo.
function maskJid(jid: string): string {
  const [user, domain] = jid.split('@')
  if (!user) return '[REDACTED]'
  const digits = user.replace(/\D/g, '')
  const tail = digits.length >= 4 ? `***${digits.slice(-4)}` : '[REDACTED]'
  return domain ? `${tail}@${domain}` : tail
}
