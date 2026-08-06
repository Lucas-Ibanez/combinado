// =============================================================================
// A · SESSION GATEWAY
// -----------------------------------------------------------------------------
// Responsabilidade: conectar ao WhatsApp via Baileys como dispositivo vinculado,
// capturar mensagens em tempo real, normalizá-las em "evento mínimo" e publicar
// na risk_queue. É o ÚNICO módulo que toca chaves de sessão do Baileys.
//
// Neste bootstrap ainda não há Baileys — só o esqueleto que a F5 vai preencher.
// =============================================================================
import type { Logger } from '../shared/logging/index.js'

export interface GatewayHandle {
  stop(): Promise<void>
}

export async function startGateway(log: Logger): Promise<GatewayHandle> {
  log.info('gateway online', { status: 'ready', role: 'session_gateway' })
  // F5: aqui entra o socket Baileys, restauração de authState, reconexão etc.
  return {
    async stop() {
      log.info('gateway parando')
    },
  }
}
