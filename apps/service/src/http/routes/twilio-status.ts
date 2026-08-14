import { Hono } from 'hono'
import { twilioSignature, getTwilioParams } from '../middleware/twilio-signature.js'
import {
  _buildGatherResponseForTest as buildGatherResponse,
  _buildVoiceTwimlForTest as buildVoiceTwiml,
} from '../../orchestrator/channels/call.js'
import type { Logger } from '../../shared/logging/index.js'

export function twilioStatusRoutes(log: Logger): Hono {
  const app = new Hono()

  app.post('/sms', twilioSignature, (c) => {
    const params = getTwilioParams(c)
    const messageSid = params.MessageSid ?? params.SmsSid ?? ''
    const status = params.MessageStatus ?? params.SmsStatus ?? ''

    log.info('twilio sms status', {
      message_sid: messageSid,
      status,
    })

    return new Response(null, { status: 204 })
  })

  app.post('/voice', twilioSignature, (c) => {
    const params = getTwilioParams(c)
    const callSid = params.CallSid ?? ''
    const status = params.CallStatus ?? ''
    const answeredBy = params.AnsweredBy ?? ''

    log.info('twilio voice status', {
      call_sid: callSid,
      status,
      answered_by: answeredBy || undefined,
    })

    return new Response(null, { status: 204 })
  })

  app.post('/gather', twilioSignature, (c) => {
    const params = getTwilioParams(c)
    const digit = params.Digits ?? ''
    const callSid = params.CallSid ?? ''

    log.info('twilio gather', {
      call_sid: callSid,
      digit,
    })

    const twiml = buildGatherResponse(digit)
    return c.body(twiml, 200, { 'Content-Type': 'text/xml' })
  })

  app.post('/voice-twiml', twilioSignature, (c) => {
    const twiml = buildVoiceTwiml()
    return c.body(twiml, 200, { 'Content-Type': 'text/xml' })
  })

  return app
}
