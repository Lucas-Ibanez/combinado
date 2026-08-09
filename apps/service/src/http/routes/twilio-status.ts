import { Hono } from 'hono'
import { twilioSignature, getTwilioParams } from '../middleware/twilio-signature.js'
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

    log.info('twilio voice status', {
      call_sid: callSid,
      status,
    })

    return new Response(null, { status: 204 })
  })

  return app
}
