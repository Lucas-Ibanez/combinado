// =============================================================================
// A · SESSION GATEWAY
// -----------------------------------------------------------------------------
// Responsabilidade: conectar ao WhatsApp via Baileys por protegido, capturar
// mensagens, normalizá-las e publicar na risk_queue. É o ÚNICO módulo que
// toca chaves de sessão do Baileys.
//
// Fluxo do pareamento (T5.2):
//   1. Guardião chama Command API pair-device → pair_device_tx enfileira
//      job em command_outbox
//   2. Este módulo consome o job e delega ao PairingManager
//   3. Manager abre Baileys para aquele protegido, grava QR em
//      protected_persons.baileys_pairing_qr, e ao abrir sessão marca 'paired'
// =============================================================================
import type { Logger } from '../shared/logging/index.js'
import { PairingManager, startOutboxLoop, type OutboxLoopHandle } from './pairing/index.js'

export interface GatewayHandle {
  stop(): Promise<void>
}

export async function startGateway(log: Logger): Promise<GatewayHandle> {
  log.info('gateway online', { status: 'ready', role: 'session_gateway' })

  const manager = new PairingManager(log.child({ subsystem: 'pairing' }))
  await manager.restorePaired()

  const outboxLoop: OutboxLoopHandle = startOutboxLoop(
    manager,
    log.child({ subsystem: 'outbox' }),
  )

  return {
    async stop() {
      log.info('gateway parando')
      await outboxLoop.stop()
      await manager.stopAll()
    },
  }
}
