import twilio from 'twilio'
import type { Logger } from '../shared/logging/index.js'
import { orchestratorDb as db } from '../shared/db/roles.js'
import { config } from '../shared/config/index.js'

export interface PostAckResult {
  sent: boolean
  channel: 'sms' | 'call' | 'none'
  error?: string
}

function buildSafeMessage(personName: string, guardianName: string): string {
  return [
    `[Combinado] ${personName}, seu guardiao ${guardianName} verificou e confirmou:`,
    'esta tudo bem com a mensagem recebida.',
    'Caso tenha duvidas, ligue diretamente para ele(a).',
  ].join(' ')
}

function buildThreatMessage(personName: string, guardianName: string): string {
  return [
    `[Combinado] ATENCAO ${personName}!`,
    `Seu guardiao ${guardianName} NAO reconheceu o pedido que voce recebeu.`,
    'NAO faca nenhuma transferencia ou Pix.',
    'Ligue diretamente para seu familiar para confirmar.',
  ].join(' ')
}

function buildSafeCallTwiml(personName: string, guardianName: string): string {
  const t = new twilio.twiml.VoiceResponse()

  t.say(
    { voice: 'Polly.Camila', language: 'pt-BR' },
    `${personName}, aqui é o Combinado, sistema de proteção familiar.`,
  )
  t.pause({ length: 1 })
  t.say(
    { voice: 'Polly.Camila', language: 'pt-BR' },
    `Seu guardião ${guardianName} verificou a mensagem suspeita e confirmou que está tudo bem. ` +
    'Caso tenha dúvidas, ligue diretamente para ele.',
  )

  return t.toString()
}

function buildThreatCallTwiml(personName: string, guardianName: string): string {
  const t = new twilio.twiml.VoiceResponse()

  t.say(
    { voice: 'Polly.Camila', language: 'pt-BR' },
    `Atenção, ${personName}! Aqui é o Combinado, sistema de proteção familiar.`,
  )
  t.pause({ length: 1 })
  t.say(
    { voice: 'Polly.Camila', language: 'pt-BR' },
    `Seu guardião ${guardianName} NÃO reconheceu o pedido que você recebeu. ` +
    'NÃO faça nenhuma transferência ou Pix. ' +
    'Ligue diretamente para seu familiar para confirmar.',
  )
  t.pause({ length: 1 })
  t.say(
    { voice: 'Polly.Camila', language: 'pt-BR' },
    'Repito: NÃO transfira nenhum valor. Confirme pessoalmente com sua família.',
  )

  return t.toString()
}

export async function sendPostAckConfirmation(
  incidentId: string,
  guardianId: string,
  ackAction: string,
  log: Logger,
): Promise<PostAckResult> {
  const { data: incident } = await db
    .from('incidents')
    .select('protected_person_id')
    .eq('id', incidentId)
    .single()

  if (!incident) {
    log.warn('post-ack: incidente não encontrado', { incident_id: incidentId })
    return { sent: false, channel: 'none', error: 'incident_not_found' }
  }

  const { data: person } = await db
    .from('protected_persons')
    .select('phone, display_name')
    .eq('id', incident.protected_person_id)
    .single()

  if (!person?.phone) {
    log.warn('post-ack: protegido sem telefone', {
      incident_id: incidentId,
      protected_person_id: incident.protected_person_id,
    })
    return { sent: false, channel: 'none', error: 'no_protected_phone' }
  }

  const { data: guardian } = await db
    .from('guardians')
    .select('display_name')
    .eq('id', guardianId)
    .single()

  const guardianName = guardian?.display_name ?? 'seu guardião'
  const isThreat = ackAction === 'threat_confirmed'

  const smsResult = await trySms(
    person.phone,
    person.display_name,
    guardianName,
    isThreat,
    incidentId,
    log,
  )

  if (smsResult.sent) return smsResult

  const callResult = await tryCall(
    person.phone,
    person.display_name,
    guardianName,
    isThreat,
    incidentId,
    log,
  )

  return callResult
}

async function trySms(
  phone: string,
  personName: string,
  guardianName: string,
  isThreat: boolean,
  incidentId: string,
  log: Logger,
): Promise<PostAckResult> {
  if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_PHONE_NUMBER) {
    log.debug('post-ack: Twilio não configurado, pulando SMS')
    return { sent: false, channel: 'sms', error: 'twilio_not_configured' }
  }

  const body = isThreat
    ? buildThreatMessage(personName, guardianName)
    : buildSafeMessage(personName, guardianName)

  try {
    const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
    await client.messages.create({
      to: phone,
      from: config.TWILIO_PHONE_NUMBER,
      body,
    })

    log.info('post-ack: confirmação enviada ao protegido via SMS', {
      incident_id: incidentId,
      is_threat: isThreat,
    })

    return { sent: true, channel: 'sms' }
  } catch (err) {
    log.warn('post-ack: falha ao enviar SMS, tentando ligação', {
      incident_id: incidentId,
      error: (err as Error).message,
    })
    return { sent: false, channel: 'sms', error: (err as Error).message }
  }
}

async function tryCall(
  phone: string,
  personName: string,
  guardianName: string,
  isThreat: boolean,
  incidentId: string,
  log: Logger,
): Promise<PostAckResult> {
  if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN || !config.TWILIO_PHONE_NUMBER) {
    log.debug('post-ack: Twilio não configurado, pulando ligação')
    return { sent: false, channel: 'call', error: 'twilio_not_configured' }
  }

  const twiml = isThreat
    ? buildThreatCallTwiml(personName, guardianName)
    : buildSafeCallTwiml(personName, guardianName)

  try {
    const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
    await client.calls.create({
      to: phone,
      from: config.TWILIO_PHONE_NUMBER,
      twiml,
    })

    log.info('post-ack: confirmação enviada ao protegido via ligação', {
      incident_id: incidentId,
      is_threat: isThreat,
    })

    return { sent: true, channel: 'call' }
  } catch (err) {
    log.error('post-ack: falha ao ligar para protegido', {
      incident_id: incidentId,
      error: (err as Error).message,
    })
    return { sent: false, channel: 'none', error: (err as Error).message }
  }
}

export {
  buildSafeMessage as _buildSafeMessageForTest,
  buildThreatMessage as _buildThreatMessageForTest,
}
