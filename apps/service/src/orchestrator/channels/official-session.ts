import path from 'node:path'
import {
  makeWASocket,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys'
import type { Logger } from '../../shared/logging/index.js'

export type OfficialSessionHealth = 'connected' | 'reconnecting' | 'disconnected'

export interface OfficialSessionHandle {
  stop(): Promise<void>
  health(): OfficialSessionHealth
  socket(): WASocket | null
}

const KEYS_DIR = path.resolve(process.cwd(), 'keys', '_official')

const RECONNECT_BASE_MS = [1_000, 3_000, 5_000, 10_000, 30_000]

function jitteredDelay(attempt: number): number {
  const base = RECONNECT_BASE_MS[Math.min(attempt, RECONNECT_BASE_MS.length - 1)]!
  const jitter = Math.floor(Math.random() * base * 0.3)
  return base + jitter
}

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

export async function startOfficialSession(
  log: Logger,
): Promise<OfficialSessionHandle> {
  let stopped = false
  let sock: WASocket | null = null
  let reconnectAttempt = 0
  let currentTimer: NodeJS.Timeout | null = null
  let currentHealth: OfficialSessionHealth = 'disconnected'

  async function connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(KEYS_DIR)
    const { version } = await fetchLatestBaileysVersion()
    const hasCreds = !!state.creds?.me

    log.info('official-session: conectando', {
      has_saved_creds: hasCreds,
      attempt: reconnectAttempt,
      wa_version: version.join('.'),
    })

    sock = makeWASocket({
      version,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      logger: silentLogger,
    })

    sock.ev.on('creds.update', saveCreds)

    if (!hasCreds && !sock.authState.creds.registered) {
      log.warn('official-session: sem credenciais — precisa parear. Use pair-official-device')
    }

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        log.info('official-session: QR code gerado — escaneie com o WhatsApp Business do número oficial')
      }

      if (connection === 'open') {
        reconnectAttempt = 0
        currentHealth = 'connected'
        const jid = sock?.user?.id ?? null
        log.info('official-session: CONECTADA', {
          jid: jid ? maskJid(jid) : null,
        })
      }

      if (connection === 'close') {
        const err = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode
        const loggedOut = err === DisconnectReason.loggedOut

        currentHealth = 'disconnected'
        sock = null

        log.info('official-session: desconectada', {
          logged_out: loggedOut,
          disconnect_code: err ?? null,
        })

        if (stopped) return

        if (loggedOut) {
          log.warn('official-session: deslogada — apague keys/_official para reparear')
          return
        }

        scheduleReconnect()
      }
    })
  }

  function scheduleReconnect() {
    const delay = jitteredDelay(reconnectAttempt)
    reconnectAttempt += 1
    currentHealth = 'reconnecting'
    log.info('official-session: reconectando', { delay_ms: delay, next_attempt: reconnectAttempt })

    currentTimer = setTimeout(() => {
      if (stopped) return
      void connect().catch((err) => {
        log.error('official-session: falha ao reconectar', { error_name: (err as Error).name })
        scheduleReconnect()
      })
    }, delay)
  }

  await connect()

  return {
    async stop() {
      stopped = true
      currentHealth = 'disconnected'
      if (currentTimer) clearTimeout(currentTimer)
      try {
        sock?.end(undefined)
      } catch {
        // já fechado
      }
      sock = null
    },
    health(): OfficialSessionHealth {
      return currentHealth
    },
    socket(): WASocket | null {
      return sock
    },
  }
}

function maskJid(jid: string): string {
  const [user, domain] = jid.split('@')
  if (!user) return '[REDACTED]'
  const digits = user.replace(/\D/g, '')
  const tail = digits.length >= 4 ? `***${digits.slice(-4)}` : '[REDACTED]'
  return domain ? `${tail}@${domain}` : tail
}
