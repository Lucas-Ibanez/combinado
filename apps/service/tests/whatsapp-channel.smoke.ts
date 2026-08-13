// Smoke test para o WhatsAppChannel — valida o canal sem socket real.
// Testa: (1) envio com sucesso via mock do socket, (2) falha quando sessão
// desconectada, (3) falha quando não há telefone, (4) delay humanizado,
// (5) registerChannel integra com dispatcher.

import type { OfficialSessionHandle } from '../src/orchestrator/channels/official-session.js'
import { WhatsAppChannel } from '../src/orchestrator/channels/whatsapp.js'
import { registerChannel, dispatcher, _resetDispatcherForTest } from '../src/orchestrator/ladder/dispatch.js'
import { createLogger } from '../src/shared/logging/index.js'

const log = createLogger('test')
let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}

// ---------------------------------------------------------------------------
// Mock da sessão oficial
// ---------------------------------------------------------------------------
interface MockSendCall {
  jid: string
  content: { text: string }
}

function createMockSession(opts: {
  connected?: boolean
  sendResult?: { key?: { id?: string } }
  sendError?: Error
} = {}): OfficialSessionHandle & { calls: MockSendCall[] } {
  const calls: MockSendCall[] = []
  const connected = opts.connected ?? true

  const mockSock: any = {
    sendMessage: async (jid: string, content: { text: string }) => {
      calls.push({ jid, content })
      if (opts.sendError) throw opts.sendError
      return opts.sendResult ?? { key: { id: 'mock-msg-id-123' } }
    },
  }

  return {
    calls,
    async stop() {},
    health() { return connected ? 'connected' : 'disconnected' },
    socket() { return connected ? mockSock : null },
  }
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------
console.log('\n=== WhatsAppChannel ===\n')

{
  // Test 1: envio com sucesso
  const session = createMockSession()
  const channel = new WhatsAppChannel(session)
  const start = Date.now()
  const result = await channel.send(
    { guardian_id: 'g-1', phone: '+5511999887766' },
    'inc-001',
    log,
  )
  const elapsed = Date.now() - start

  assert(result.sent === true, 'envia com sucesso')
  assert(session.calls.length === 1, 'fez exatamente 1 chamada ao socket')
  assert(session.calls[0]!.jid === '5511999887766@s.whatsapp.net', 'JID correto')
  assert(session.calls[0]!.content.text.includes('Alerta Combinado'), 'texto contém alerta')
  assert(elapsed >= 1500, `delay humanizado aplicado (${elapsed}ms >= 1500ms)`)
}

{
  // Test 2: falha quando sessão desconectada
  const session = createMockSession({ connected: false })
  const channel = new WhatsAppChannel(session)
  const result = await channel.send(
    { guardian_id: 'g-2', phone: '+5511888776655' },
    'inc-002',
    log,
  )
  assert(result.sent === false, 'retorna sent: false quando desconectado')
  assert(result.error === 'official_session_disconnected', 'erro correto')
}

{
  // Test 3: falha quando sem telefone
  const session = createMockSession()
  const channel = new WhatsAppChannel(session)
  const result = await channel.send(
    { guardian_id: 'g-3', phone: null },
    'inc-003',
    log,
  )
  assert(result.sent === false, 'retorna sent: false sem telefone')
  assert(result.error === 'no_phone', 'erro correto para no_phone')
}

{
  // Test 4: falha no sendMessage é capturada
  const session = createMockSession({ sendError: new Error('socket-closed') })
  const channel = new WhatsAppChannel(session)
  const result = await channel.send(
    { guardian_id: 'g-4', phone: '+5511777665544' },
    'inc-004',
    log,
  )
  assert(result.sent === false, 'retorna sent: false no erro do socket')
  assert(result.error === 'socket-closed', 'propaga mensagem de erro')
}

console.log('\n=== registerChannel + dispatcher ===\n')

{
  // Test 5: registerChannel integra com o dispatcher
  _resetDispatcherForTest()

  const session = createMockSession()
  const channel = new WhatsAppChannel(session)
  registerChannel('whatsapp', (target, incidentId, channelLog) =>
    channel.send(target, incidentId, channelLog),
  )

  const result = await dispatcher.send(
    'whatsapp',
    { guardian_id: 'g-5', phone: '+5511666554433' },
    'inc-005',
    log,
  )

  assert(result.sent === true, 'dispatcher roteia para WhatsAppChannel')
  assert(session.calls.length === 1, 'chamada chegou ao canal real')
  assert(session.calls[0]!.jid === '5511666554433@s.whatsapp.net', 'JID via dispatcher correto')
}

{
  // Test 6: canais não registrados continuam como mock
  _resetDispatcherForTest()

  const result = await dispatcher.send(
    'push',
    { guardian_id: 'g-6', phone: '+5511555443322' },
    'inc-006',
    log,
  )

  assert(result.sent === true, 'canal não registrado usa mock')
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(50)}`)
console.log(`Resultado: ${passed} passaram, ${failed} falharam de ${passed + failed}`)
if (failed > 0) process.exit(1)
console.log('Todos os testes passaram!\n')
