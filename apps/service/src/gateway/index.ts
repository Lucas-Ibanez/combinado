// =============================================================================
// A · SESSION GATEWAY
// -----------------------------------------------------------------------------
// Responsabilidade: conectar ao WhatsApp via Baileys como dispositivo vinculado,
// capturar mensagens em tempo real, normalizá-las em "evento mínimo" e publicar
// na risk_queue. É o ÚNICO módulo que toca chaves de sessão do Baileys.
// =============================================================================
import type { Logger } from '../shared/logging/index.js'
import { startBaileysConnection, type BaileysHandle } from './baileys/index.js'

export interface GatewayHandle {
  stop(): Promise<void>
}

export async function startGateway(log: Logger): Promise<GatewayHandle> {
  log.info('gateway online', { status: 'ready', role: 'session_gateway' })

  let baileys: BaileysHandle | null = null
  try {
    baileys = await startBaileysConnection(log.child({ subsystem: 'baileys' }))
  } catch (err) {
    log.error('falha ao iniciar Baileys', {
      error_name: (err as Error).name,
      error_message: (err as Error).message,
    })
    throw err
  }

  return {
    async stop() {
      log.info('gateway parando')
      if (baileys) await baileys.stop()
    },
  }
}
