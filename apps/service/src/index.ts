// =============================================================================
// BOOTSTRAP DO SERVIÇO
// -----------------------------------------------------------------------------
// Sobe os três papéis no mesmo processo. A separação aqui é LÓGICA — cada
// papel vive no seu próprio módulo e conversa com os outros só via fila (nunca
// via chamada de função direta). Quando o volume exigir escala horizontal,
// basta cada `start*` virar um `index.ts` de processo separado — o recorte já
// está desenhado.
//
// Ordem:
//   0. Config validada (import cedo — falha se faltar env)
//   1. Sanity check do banco (falha cedo se creds erradas)
//   2. C · Orchestrator (consumidor)
//   3. B · Risk Worker (consumidor)
//   4. A · Session Gateway (produtor — sobe por último, quando o consumo já
//      está pronto para receber eventos)
//   5. Handlers de shutdown (SIGINT/SIGTERM)
//   6. Servidor HTTP para webhooks (T9.1)
// =============================================================================
import { config } from './shared/config/index.js'
import { db } from './shared/db/index.js'
import { createLogger } from './shared/logging/index.js'
import { startGateway } from './gateway/index.js'
import { startRisk } from './risk/index.js'
import { startOrchestrator } from './orchestrator/index.js'
import { startHttpServer } from './http/index.js'
import { startOfficialSession, WhatsAppChannel, ProtocolSender, CallChannel, PushChannel, SmsChannel } from './orchestrator/channels/index.js'
import { registerChannel } from './orchestrator/ladder/dispatch.js'
import { registerProtocolSender } from './orchestrator/ladder/index.js'
import { startSimulationWorker } from './simulation/index.js'
import { attachSimulationResponseHandler } from './simulation/response-handler.js'

const log = createLogger('bootstrap')

async function checkDatabase(): Promise<void> {
  const { error } = await db.from('families').select('*', { count: 'exact', head: true })
  if (error) throw new Error(`Supabase indisponível: ${error.message}`)
}

async function main() {
  log.info('serviço iniciando', { node_env: config.NODE_ENV })

  await checkDatabase()
  log.info('banco OK')

  // Sessão oficial do Combinado (Baileys para envio de alertas via WhatsApp).
  // Sobe antes do orchestrator para que o canal já esteja disponível quando
  // a escada precisar enviar.
  const officialLog = createLogger('official-session')
  const officialSession = await startOfficialSession(officialLog)
  const whatsappChannel = new WhatsAppChannel(officialSession)
  registerChannel('whatsapp', (target, incidentId, channelLog) =>
    whatsappChannel.send(target, incidentId, channelLog),
  )
  const protocolSender = new ProtocolSender(officialSession)
  registerProtocolSender((phone, name, incidentId, protocolLog) =>
    protocolSender.sendProtocol(phone, name, incidentId, protocolLog),
  )
  const callChannel = new CallChannel()
  registerChannel('call', (target, incidentId, channelLog) =>
    callChannel.send(target, incidentId, channelLog),
  )
  const pushChannel = new PushChannel()
  registerChannel('push', (target, incidentId, channelLog) =>
    pushChannel.send(target, incidentId, channelLog),
  )
  const smsChannel = new SmsChannel()
  registerChannel('sms', (target, incidentId, channelLog) =>
    smsChannel.send(target, incidentId, channelLog),
  )
  log.info('canais whatsapp + protocolo + call + push + sms registrados', { health: officialSession.health() })

  // Ordem: consumidores primeiro, produtor depois.
  const orchestrator = await startOrchestrator(createLogger('orchestrator'))
  const simulationWorker = await startSimulationWorker(officialSession, createLogger('simulation'))
  attachSimulationResponseHandler(officialSession, createLogger('simulation-response'))
  const risk = await startRisk(createLogger('risk'))
  const gateway = await startGateway(createLogger('gateway'))
  const http = startHttpServer(createLogger('http'))

  log.info('serviço no ar', { roles: ['gateway', 'risk', 'orchestrator', 'simulation', 'http', 'official-wa'] })

  async function shutdown(signal: string) {
    log.info('shutdown iniciado', { signal })
    try {
      // Fecha na ordem inversa: produtor primeiro (para de gerar), depois
      // consumidores (drenam o que já enfileiraram).
      await http.stop()
      await gateway.stop()
      await risk.stop()
      await simulationWorker.stop()
      await orchestrator.stop()
      await officialSession.stop()
      log.info('shutdown concluído')
      process.exit(0)
    } catch (err) {
      log.error('erro no shutdown', { error_name: (err as Error).name })
      process.exit(1)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((err) => {
  log.error('erro fatal na inicialização', {
    error_name: (err as Error).name,
    error_message: (err as Error).message,
  })
  process.exit(1)
})
