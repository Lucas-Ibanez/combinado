import type { DeliveryChannel } from '@combinado/shared'
import type { Logger } from '../../shared/logging/index.js'
import { guardChannel, _resetGuardsForTest as resetGuards } from './channel-guard.js'

export interface DispatchTarget {
  guardian_id: string
  phone?: string | null
  push_subscription?: unknown | null
}

export interface DispatchResult {
  sent: boolean
  error?: string
}

export type ChannelSendFn = (
  target: DispatchTarget,
  incidentId: string,
  log: Logger,
) => Promise<DispatchResult>

export interface ChannelDispatcher {
  send(
    channel: DeliveryChannel,
    target: DispatchTarget,
    incidentId: string,
    log: Logger,
  ): Promise<DispatchResult>
}

const channelHandlers = new Map<DeliveryChannel, ChannelSendFn>()

function mockSend(channel: DeliveryChannel): ChannelSendFn {
  return async (target, incidentId, log) => {
    log.info('canal mockado: envio simulado', {
      channel,
      guardian_id: target.guardian_id,
      incident_id: incidentId,
    })
    return { sent: true }
  }
}

export function registerChannel(channel: DeliveryChannel, handler: ChannelSendFn): void {
  channelHandlers.set(channel, guardChannel(channel, handler))
}

export const dispatcher: ChannelDispatcher = {
  send(channel, target, incidentId, log) {
    const handler = channelHandlers.get(channel) ?? mockSend(channel)
    return handler(target, incidentId, log)
  },
}

export function _setDispatcherForTest(d: ChannelDispatcher): void {
  channelHandlers.clear()
  for (const ch of ['push', 'whatsapp', 'sms', 'call'] as DeliveryChannel[]) {
    channelHandlers.set(ch, (t, i, l) => d.send(ch, t, i, l))
  }
}

export function _resetDispatcherForTest(): void {
  channelHandlers.clear()
  resetGuards()
}
