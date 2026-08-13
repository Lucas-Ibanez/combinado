import type { Logger } from '../../shared/logging/index.js'
import type { DispatchTarget, DispatchResult } from '../ladder/dispatch.js'
import type { OfficialSessionHandle } from './official-session.js'

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs))
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@s.whatsapp.net`
}

export class WhatsAppChannel {
  constructor(private session: OfficialSessionHandle) {}

  async send(
    target: DispatchTarget,
    incidentId: string,
    log: Logger,
  ): Promise<DispatchResult> {
    const sock = this.session.socket()

    if (!sock) {
      log.warn('whatsapp-channel: sessão oficial desconectada', {
        incident_id: incidentId,
        health: this.session.health(),
      })
      return { sent: false, error: 'official_session_disconnected' }
    }

    if (!target.phone) {
      log.warn('whatsapp-channel: sem telefone do alvo', {
        incident_id: incidentId,
        guardian_id: target.guardian_id,
      })
      return { sent: false, error: 'no_phone' }
    }

    const jid = phoneToJid(target.phone)

    await randomDelay(2_000, 5_000)

    try {
      const result = await sock.sendMessage(jid, {
        text: [
          '⚠️ *Alerta Combinado*',
          '',
          'Detectamos uma mensagem suspeita direcionada a um membro da sua família.',
          '',
          'Por favor, verifique o app Combinado para mais detalhes e confirme a situação.',
          '',
          '_Esta é uma mensagem automática do sistema Combinado de proteção familiar._',
        ].join('\n'),
      })

      log.info('whatsapp-channel: mensagem enviada', {
        incident_id: incidentId,
        guardian_id: target.guardian_id,
        message_id: result?.key?.id ?? null,
      })

      return { sent: true }
    } catch (err) {
      log.error('whatsapp-channel: falha ao enviar', {
        incident_id: incidentId,
        guardian_id: target.guardian_id,
        error_name: (err as Error).name,
        error_message: (err as Error).message,
      })
      return { sent: false, error: (err as Error).message }
    }
  }
}
