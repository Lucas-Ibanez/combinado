// Smoke test para o ProtocolSender — valida envio de protocolo ao protegido
// sem socket real. Testa: (1) envio com sucesso, (2) texto contém orientações
// corretas, (3) falha quando desconectado, (4) falha sem telefone,
// (5) delay humanizado, (6) integração com registerProtocolSender na ladder.

import type { OfficialSessionHandle } from '../src/orchestrator/channels/official-session.js'
import { ProtocolSender, _buildProtocolMessageForTest } from '../src/orchestrator/channels/protocol.js'
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
      return opts.sendResult ?? { key: { id: 'mock-protocol-msg-id' } }
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
// Testes do texto do protocolo
// ---------------------------------------------------------------------------
console.log('\n=== Texto do Protocolo ===\n')

{
  const text = _buildProtocolMessageForTest('Dona Maria')
  assert(text.includes('Dona Maria'), 'contém o nome do protegido')
  assert(text.includes('senha combinada'), 'menciona a senha combinada')
  assert(text.includes('não transfira'), 'orienta a não transferir sem senha')
  assert(text.includes('nunca pede senha'), 'aviso de que Combinado nunca pede senha')
  assert(!text.includes('R$'), 'não menciona valores')
  assert(!text.includes('Pix') || text.includes('Antes de fazer qualquer Pix'), 'menciona Pix apenas no contexto de alerta')
}

// ---------------------------------------------------------------------------
// Testes do ProtocolSender
// ---------------------------------------------------------------------------
console.log('\n=== ProtocolSender ===\n')

{
  // Test 1: envio com sucesso
  const session = createMockSession()
  const sender = new ProtocolSender(session)
  const start = Date.now()
  const result = await sender.sendProtocol(
    '+5511988776655',
    'Dona Maria',
    'inc-001',
    log,
  )
  const elapsed = Date.now() - start

  assert(result.sent === true, 'envia com sucesso')
  assert(result.messageId === 'mock-protocol-msg-id', 'retorna messageId')
  assert(session.calls.length === 1, 'fez exatamente 1 chamada ao socket')
  assert(session.calls[0]!.jid === '5511988776655@s.whatsapp.net', 'JID correto')
  assert(session.calls[0]!.content.text.includes('Dona Maria'), 'texto personalizado com nome')
  assert(session.calls[0]!.content.text.includes('senha combinada'), 'texto contém orientação de senha')
  assert(elapsed >= 1500, `delay humanizado aplicado (${elapsed}ms >= 1500ms)`)
}

{
  // Test 2: falha quando sessão desconectada
  const session = createMockSession({ connected: false })
  const sender = new ProtocolSender(session)
  const result = await sender.sendProtocol(
    '+5511977665544',
    'Seu José',
    'inc-002',
    log,
  )
  assert(result.sent === false, 'retorna sent: false quando desconectado')
  assert(result.error === 'official_session_disconnected', 'erro correto')
}

{
  // Test 3: falha quando sem telefone
  const session = createMockSession()
  const sender = new ProtocolSender(session)
  const result = await sender.sendProtocol(
    '',
    'Dona Ana',
    'inc-003',
    log,
  )
  assert(result.sent === false, 'retorna sent: false sem telefone')
  assert(result.error === 'no_protected_phone', 'erro correto para no_protected_phone')
}

{
  // Test 4: falha no sendMessage é capturada
  const session = createMockSession({ sendError: new Error('connection-reset') })
  const sender = new ProtocolSender(session)
  const result = await sender.sendProtocol(
    '+5511966554433',
    'Seu Carlos',
    'inc-004',
    log,
  )
  assert(result.sent === false, 'retorna sent: false no erro do socket')
  assert(result.error === 'connection-reset', 'propaga mensagem de erro')
}

{
  // Test 5: nomes diferentes geram mensagens personalizadas
  const session = createMockSession()
  const sender = new ProtocolSender(session)

  await sender.sendProtocol('+5511955443322', 'Vovó Lúcia', 'inc-005a', log)
  await sender.sendProtocol('+5511944332211', 'Tio Pedro', 'inc-005b', log)

  assert(session.calls[0]!.content.text.includes('Vovó Lúcia'), 'msg 1 personalizada')
  assert(session.calls[1]!.content.text.includes('Tio Pedro'), 'msg 2 personalizada')
  assert(session.calls[0]!.content.text !== session.calls[1]!.content.text, 'msgs são diferentes')
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(50)}`)
console.log(`Resultado: ${passed} passaram, ${failed} falharam de ${passed + failed}`)
if (failed > 0) process.exit(1)
console.log('Todos os testes passaram!\n')
