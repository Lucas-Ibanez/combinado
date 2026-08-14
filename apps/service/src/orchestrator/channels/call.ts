import twilio from 'twilio'
import type { Logger } from '../../shared/logging/index.js'
import type { DispatchTarget, DispatchResult } from '../ladder/dispatch.js'
import { config } from '../../shared/config/index.js'

function buildTwiml(): string {
  const twiml = new twilio.twiml.VoiceResponse()

  twiml.say(
    { voice: 'Polly.Camila', language: 'pt-BR' },
    'Atenção. Esta é uma ligação automática do Combinado, sistema de proteção familiar.',
  )

  twiml.pause({ length: 1 })

  twiml.say(
    { voice: 'Polly.Camila', language: 'pt-BR' },
    'Detectamos uma mensagem suspeita no WhatsApp de um membro da sua família. ' +
    'Não faça nenhuma transferência ou Pix sem antes confirmar com seu familiar.',
  )

  twiml.pause({ length: 1 })

  twiml.say(
    { voice: 'Polly.Camila', language: 'pt-BR' },
    'Lembre-se: peça a senha combinada antes de qualquer transferência.',
  )

  twiml.pause({ length: 1 })

  const gather = twiml.gather({
    numDigits: 1,
    timeout: 10,
    action: '/webhooks/twilio/gather',
    method: 'POST',
  })

  gather.say(
    { voice: 'Polly.Camila', language: 'pt-BR' },
    'Para ouvir novamente, pressione 1.',
  )

  twiml.say(
    { voice: 'Polly.Camila', language: 'pt-BR' },
    'Nenhuma tecla pressionada. Abra o aplicativo Combinado para mais detalhes. Até logo.',
  )

  return twiml.toString()
}

function buildGatherResponse(digit: string): string {
  const twiml = new twilio.twiml.VoiceResponse()

  if (digit === '1') {
    twiml.redirect({ method: 'POST' }, '/webhooks/twilio/voice-twiml')
  } else {
    twiml.say(
      { voice: 'Polly.Camila', language: 'pt-BR' },
      'Abra o aplicativo Combinado para mais detalhes. Até logo.',
    )
  }

  return twiml.toString()
}

function buildVoiceTwiml(): string {
  return buildTwiml()
}

export class CallChannel {
  async send(
    target: DispatchTarget,
    incidentId: string,
    log: Logger,
  ): Promise<DispatchResult> {
    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_PHONE_NUMBER) {
      log.warn('call-channel: Twilio não configurado', {
        incident_id: incidentId,
      })
      return { sent: false, error: 'twilio_not_configured' }
    }

    if (!target.phone) {
      log.warn('call-channel: sem telefone do alvo', {
        incident_id: incidentId,
        guardian_id: target.guardian_id,
      })
      return { sent: false, error: 'no_phone' }
    }

    const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)

    const twiml = buildTwiml()

    try {
      const call = await client.calls.create({
        to: target.phone,
        from: config.TWILIO_PHONE_NUMBER,
        twiml,
        statusCallback: buildStatusCallbackUrl(),
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        machineDetection: 'Enable',
        asyncAmd: 'true',
      })

      log.info('call-channel: ligação iniciada', {
        incident_id: incidentId,
        guardian_id: target.guardian_id,
        call_sid: call.sid,
      })

      return { sent: true }
    } catch (err) {
      log.error('call-channel: falha ao iniciar ligação', {
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
  return `${base}/webhooks/twilio/voice`
}

export {
  buildTwiml as _buildTwimlForTest,
  buildGatherResponse as _buildGatherResponseForTest,
  buildVoiceTwiml as _buildVoiceTwimlForTest,
}
