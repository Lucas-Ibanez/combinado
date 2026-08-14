import twilio from 'twilio'
import type { Logger } from '../../shared/logging/index.js'
import type { DispatchTarget, DispatchResult } from '../ladder/dispatch.js'
import { config } from '../../shared/config/index.js'

export class SmsChannel {
  async send(
    target: DispatchTarget,
    incidentId: string,
    log: Logger,
  ): Promise<DispatchResult> {
    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_PHONE_NUMBER) {
      log.warn('sms-channel: Twilio não configurado', {
        incident_id: incidentId,
      })
      return { sent: false, error: 'twilio_not_configured' }
    }

    if (!target.phone) {
      log.warn('sms-channel: sem telefone do alvo', {
        incident_id: incidentId,
        guardian_id: target.guardian_id,
      })
      return { sent: false, error: 'no_phone' }
    }

    const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)

    const body = [
      '[Combinado] Alerta: mensagem suspeita detectada no WhatsApp de um membro da sua família.',
      'Não faça transferências sem confirmar com a senha combinada.',
      'Abra o app para detalhes.',
    ].join(' ')

    try {
      const message = await client.messages.create({
        to: target.phone,
        from: config.TWILIO_PHONE_NUMBER,
        body,
        statusCallback: buildStatusCallbackUrl(),
      })

      log.info('sms-channel: SMS enviado', {
        incident_id: incidentId,
        guardian_id: target.guardian_id,
        message_sid: message.sid,
      })

      return { sent: true }
    } catch (err) {
      log.error('sms-channel: falha ao enviar SMS', {
        incident_id: incidentId,
        guardian_id: target.guardian_id,
        error_name: (err as Error).name,
        error_message: (err as Error).message,
      })
      return { sent: false, error: (err as Error).message }
    }
  }
}

function buildStatusCallbackUrl(): string {
  const base = config.WEBHOOK_BASE_URL
  if (!base) return ''
  return `${base}/webhooks/twilio/sms`
}
