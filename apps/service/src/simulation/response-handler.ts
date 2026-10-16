import type { WASocket } from '@whiskeysockets/baileys'
import type { Logger } from '../shared/logging/index.js'
import { simulationDb as db } from '../shared/db/roles.js'
import type { OfficialSessionHandle } from '../orchestrator/channels/official-session.js'
import { evaluateResponse } from './messages.js'

const SIMULATION_EXPIRY_HOURS = 24

function jidToPhone(jid: string): string {
  return jid.replace(/@.*/, '').replace(/:\d+$/, '')
}

export function attachSimulationResponseHandler(
  officialSession: OfficialSessionHandle,
  log: Logger,
): void {
  let attached = false

  function tryAttach() {
    if (attached) return
    const sock = officialSession.socket()
    if (!sock) return
    attachListener(sock, log)
    attached = true
    log.info('simulation-response: handler anexado à sessão oficial')
  }

  tryAttach()
  if (!attached) {
    log.info('simulation-response: socket ainda não disponível, aguardando conexão...')
    const interval = setInterval(() => {
      tryAttach()
      if (attached) clearInterval(interval)
    }, 3_000)
  }
}

function attachListener(sock: WASocket, log: Logger): void {
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

      try {
        await handlePossibleSimulationResponse(phone, text, log)
      } catch (err) {
        log.error('simulation-response: erro ao processar', {
          error_name: (err as Error).name,
        })
      }
    }
  })
}

async function handlePossibleSimulationResponse(
  phone: string,
  responseText: string,
  log: Logger,
): Promise<void> {
  const { data: pp } = await db
    .from('protected_persons')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (!pp) return

  const cutoff = new Date(Date.now() - SIMULATION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

  const { data: sim } = await db
    .from('simulations')
    .select('id')
    .eq('protected_person_id', pp.id)
    .eq('status', 'sent')
    .gte('sent_at', cutoff)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sim) return

  const correct = evaluateResponse(responseText)

  await db
    .from('simulations')
    .update({
      status: 'responded',
      responded_at: new Date().toISOString(),
      response_correct: correct,
    })
    .eq('id', sim.id)

  log.info('simulation-response: resposta registrada', {
    simulation_id: sim.id,
    response_correct: correct,
  })
}
