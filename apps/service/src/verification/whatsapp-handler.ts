import type { WASocket } from '@whiskeysockets/baileys'
import type { Logger } from '../shared/logging/index.js'
import type { OfficialSessionHandle } from '../orchestrator/channels/official-session.js'
import { db } from '../shared/db/index.js'
import { assessText } from './assess.js'

function jidToPhone(jid: string): string {
  return '+' + jid.replace(/@.*/, '').replace(/:\d+$/, '')
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs))
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function attachVerificationHandler(
  officialSession: OfficialSessionHandle,
  log: Logger,
): void {
  const sock = officialSession.socket()
  if (!sock) {
    log.warn('verification-handler: sem socket')
    return
  }

  attachListener(sock, officialSession, log)
  log.info('verification-handler: handler anexado à sessão oficial')
}

function attachListener(
  sock: WASocket,
  session: OfficialSessionHandle,
  log: Logger,
): void {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (msg.key.fromMe) continue
      if (!msg.message) continue

      const remoteJid = msg.key.remoteJid
      if (!remoteJid || remoteJid.endsWith('@g.us')) continue

      const phone = jidToPhone(remoteJid)

      const text =
        msg.message.conversation ??
        msg.message.extendedTextMessage?.text ??
        null

      if (!text) continue

      const isFromProtected = await isProtectedPerson(phone)
      if (isFromProtected) {
        const hasPendingSim = await hasPendingSimulation(phone)
        if (hasPendingSim) continue
      }

      try {
        await handleVerification(text, remoteJid, session, log)
      } catch (err) {
        log.error('verification-handler: erro ao processar', {
          error_name: (err as Error).name,
        })
      }
    }
  })
}

async function isProtectedPerson(phone: string): Promise<boolean> {
  const { data } = await db
    .from('protected_persons')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()
  return !!data
}

async function hasPendingSimulation(phone: string): Promise<boolean> {
  const { data: pp } = await db
    .from('protected_persons')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()
  if (!pp) return false

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: sim } = await db
    .from('simulations')
    .select('id')
    .eq('protected_person_id', pp.id)
    .eq('status', 'sent')
    .gte('sent_at', cutoff)
    .limit(1)
    .maybeSingle()

  return !!sim
}

async function handleVerification(
  text: string,
  remoteJid: string,
  session: OfficialSessionHandle,
  log: Logger,
): Promise<void> {
  const result = assessText(text)

  const sock = session.socket()
  if (!sock) {
    log.warn('verification-handler: sessão desconectada ao responder')
    return
  }

  const header = '🔍 *Verificação Combinado*\n\n'
  const responseText = header + result.advice

  await randomDelay(1_500, 3_000)

  await sock.sendMessage(remoteJid, { text: responseText })

  log.info('verification-handler: resposta enviada', {
    risk_level: result.risk_level,
    severity: result.severity,
    classifier_score: result.classifier_score,
    rules_count: result.triggered_rules.length,
  })
}
