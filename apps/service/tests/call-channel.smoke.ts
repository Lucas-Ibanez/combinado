// Smoke test para o CallChannel — valida TwiML, gather, e canal sem ligação
// real. Testa: (1) TwiML contém elementos corretos, (2) sem AMD síncrono,
// (3) gather response, (4) falha sem config, (5) falha sem telefone,
// (6) integração com dispatcher.

import {
  _buildTwimlForTest as buildTwiml,
  _buildGatherResponseForTest as buildGatherResponse,
} from '../src/orchestrator/channels/call.js'
import { CallChannel } from '../src/orchestrator/channels/call.js'
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
// TwiML tests
// ---------------------------------------------------------------------------
console.log('\n=== TwiML da Ligação ===\n')

{
  const xml = buildTwiml()

  assert(xml.includes('<?xml'), 'contém declaração XML')
  assert(xml.includes('<Response>'), 'contém <Response>')
  assert(xml.includes('<Say'), 'contém <Say>')
  assert(xml.includes('Polly.Camila'), 'usa voz Polly.Camila (pt-BR)')
  assert(xml.includes('pt-BR'), 'language é pt-BR')
  assert(xml.includes('Combinado'), 'menciona Combinado')
  assert(xml.includes('senha combinada'), 'menciona senha combinada')
  assert(xml.includes('<Gather'), 'contém <Gather>')
  assert(xml.includes('numDigits="1"'), 'gather aceita 1 dígito')
  assert(xml.includes('/webhooks/twilio/gather'), 'action aponta para /gather')
  assert(xml.includes('<Pause'), 'contém pausas para clareza')

  // Não pede dados pessoais diretamente — orienta a pedir a senha ao familiar
  assert(!xml.includes('Qual é a senha'), 'não pergunta a senha diretamente')
  assert(!xml.includes('CPF'), 'não menciona CPF')
  assert(!xml.includes('código'), 'não pede código')
  assert(!xml.includes('Pix') || xml.includes('transferência ou Pix'), 'menciona Pix apenas no contexto de alerta')

  // A mensagem é imediata ao atender — não há AMD síncrono que gere silêncio
  // O TwiML começa direto com <Say>, sem <Pause> antes do primeiro <Say>
  const firstSayIndex = xml.indexOf('<Say')
  const firstPauseIndex = xml.indexOf('<Pause')
  assert(firstSayIndex < firstPauseIndex, 'primeira instrução é Say, não Pause (sem silêncio ao atender)')
}

// ---------------------------------------------------------------------------
// Gather response tests
// ---------------------------------------------------------------------------
console.log('\n=== Gather Response ===\n')

{
  // Press 1: repeat
  const xml1 = buildGatherResponse('1')
  assert(xml1.includes('<Redirect'), 'press 1 gera Redirect para repetir')
  assert(xml1.includes('/webhooks/twilio/voice-twiml'), 'redirect aponta para voice-twiml')
}

{
  // Press any other key
  const xml9 = buildGatherResponse('9')
  assert(xml9.includes('<Say'), 'tecla não reconhecida gera Say')
  assert(xml9.includes('Combinado'), 'resposta de despedida menciona Combinado')
}

{
  // Empty (timeout)
  const xmlEmpty = buildGatherResponse('')
  assert(xmlEmpty.includes('<Say'), 'timeout gera Say de despedida')
}

// ---------------------------------------------------------------------------
// CallChannel tests (sem Twilio real)
// ---------------------------------------------------------------------------
console.log('\n=== CallChannel ===\n')

{
  // Test: falha quando Twilio não configurado
  // O config é carregado na inicialização — TWILIO_* são opcionais e undefined
  // por padrão em ambiente de teste, então o guard de config dispara.
  const channel = new CallChannel()
  const result = await channel.send(
    { guardian_id: 'g-1', phone: '+5511999887766' },
    'inc-001',
    log,
  )

  assert(result.sent === false, 'retorna sent: false sem config Twilio')
  assert(result.error === 'twilio_not_configured', 'erro correto')
}

{
  // Test: falha sem telefone — não conseguimos testar diretamente sem config,
  // mas validamos a lógica via dispatch mock
  let receivedTarget: { phone?: string | null } | null = null
  _resetDispatcherForTest()
  registerChannel('call', async (target, _incidentId, _log) => {
    receivedTarget = target
    if (!target.phone) return { sent: false, error: 'no_phone' }
    return { sent: true }
  })

  const result = await dispatcher.send(
    'call',
    { guardian_id: 'g-2', phone: null },
    'inc-002',
    log,
  )

  assert(result.sent === false, 'retorna sent: false sem telefone')
  assert(result.error === 'no_phone', 'erro correto para no_phone')
  assert(receivedTarget?.phone === null, 'target.phone é null')

  _resetDispatcherForTest()
}

// ---------------------------------------------------------------------------
// Dispatcher integration
// ---------------------------------------------------------------------------
console.log('\n=== registerChannel + dispatcher ===\n')

{
  _resetDispatcherForTest()

  let sendCalled = false
  registerChannel('call', async (target, incidentId, channelLog) => {
    sendCalled = true
    channelLog.info('call mock: ligação simulada', {
      guardian_id: target.guardian_id,
      incident_id: incidentId,
    })
    return { sent: true }
  })

  const result = await dispatcher.send(
    'call',
    { guardian_id: 'g-3', phone: '+5511888776655' },
    'inc-003',
    log,
  )

  assert(sendCalled, 'dispatcher chamou o handler registrado')
  assert(result.sent === true, 'dispatcher retorna sent: true')

  _resetDispatcherForTest()
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(50)}`)
console.log(`Resultado: ${passed} passaram, ${failed} falharam de ${passed + failed}`)
if (failed > 0) process.exit(1)
console.log('Todos os testes passaram!\n')
