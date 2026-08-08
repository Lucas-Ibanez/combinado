import type { DeliveryChannel } from '@combinado/shared'
import type { Logger } from '../../shared/logging/index.js'

export interface DispatchTarget {
  guardian_id: string
  phone?: string | null
}

export interface DispatchResult {
  sent: boolean
  error?: string
}

export interface ChannelDispatcher {
  send(
    channel: DeliveryChannel,
    target: DispatchTarget,
    incidentId: string,
    log: Logger,
  ): Promise<DispatchResult>
}

class MockDispatcher implements ChannelDispatcher {
  async send(
    channel: DeliveryChannel,
    target: DispatchTarget,
    incidentId: string,
    log: Logger,
  ): Promise<DispatchResult> {
    log.info('canal mockado: envio simulado', {
      channel,
      guardian_id: target.guardian_id,
      incident_id: incidentId,
    })
    return { sent: true }
  }
}

let activeDispatcher: ChannelDispatcher = new MockDispatcher()

export const dispatcher: ChannelDispatcher = {
  send(channel, target, incidentId, log) {
    return activeDispatcher.send(channel, target, incidentId, log)
  },
}

export function _setDispatcherForTest(d: ChannelDispatcher): void {
  activeDispatcher = d
}

export function _resetDispatcherForTest(): void {
  activeDispatcher = new MockDispatcher()
}
