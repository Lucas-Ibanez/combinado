import type { Logger } from '../../shared/logging/index.js'
import type { OfficialSessionHandle } from './official-session.js'

export interface ProtocolResult {
  sent: boolean
  messageId?: string
  error?: string
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs))
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}

function buildProtocolMessage(protectedName: string): string {
  return [
    `⚠️ *Atenção, ${protectedName}!*`,
    '',
    'O Combinado detectou uma conversa suspeita no seu WhatsApp.',
    '',
    '👉 *Antes de fazer qualquer Pix ou transferência*, peça a *senha combinada* para a pessoa que está pedindo.',
    '',
    'Se a pessoa não souber a senha, *não transfira*. Ligue para seu familiar por outro meio para confirmar.',
    '',
    '_Lembre-se: o Combinado nunca pede senha, Pix ou código por mensagem._',
  ].join('\n')
}

export class ProtocolSender {
  constructor(private session: OfficialSessionHandle) {}

  async sendProtocol(
    protectedPhone: string,
    protectedName: string,
    incidentId: string,
    log: Logger,
  ): Promise<ProtocolResult> {
    const sock = this.session.socket()

    if (!sock) {
      log.warn('protocol: sessão oficial desconectada', {
        incident_id: incidentId,
        health: this.session.health(),
      })
      return { sent: false, error: 'official_session_disconnected' }
    }

    if (!protectedPhone) {
      log.warn('protocol: sem telefone do protegido', {
        incident_id: incidentId,
      })
      return { sent: false, error: 'no_protected_phone' }
    }

    const jid = phoneToJid(protectedPhone)
    const text = buildProtocolMessage(protectedName)

    await randomDelay(2_000, 5_000)

    try {
      const result = await sock.sendMessage(jid, { text })

      const messageId = result?.key?.id ?? undefined

      log.info('protocol: mensagem de protocolo enviada ao protegido', {
        incident_id: incidentId,
        message_id: messageId ?? null,
      })

      return { sent: true, messageId }
    } catch (err) {
      log.error('protocol: falha ao enviar protocolo', {
        incident_id: incidentId,
        error_name: (err as Error).name,
        error_message: (err as Error).message,
      })
      return { sent: false, error: (err as Error).message }
    }
  }
}

export { buildProtocolMessage as _buildProtocolMessageForTest }
