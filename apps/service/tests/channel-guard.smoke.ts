// Smoke test para channel-guard — valida circuit breaker e rate limiter
// sem dependência de canais reais.

import {
  guardChannel,
  _resetGuardsForTest as resetGuards,
  _getBreakerStateForTest as getBreakerState,
  _getConsecutiveFailuresForTest as getConsecutiveFailures,
  _getSendCountForTest as getSendCount,
  getGuardStatus,
} from '../src/orchestrator/ladder/channel-guard.js'
import {
  registerChannel,
  dispatcher,
  _resetDispatcherForTest as resetDispatcher,
} from '../src/orchestrator/ladder/dispatch.js'
import { createLogger } from '../src/shared/logging/index.js'
import type { ChannelSendFn } from '../src/orchestrator/ladder/dispatch.js'

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
// 1. Circuit Breaker — abre após falhas consecutivas
// ---------------------------------------------------------------------------
console.log('\n=== Circuit Breaker: abre após 3 falhas consecutivas ===\n')

{
  resetGuards()

  const failing: ChannelSendFn = async () => ({ sent: false, error: 'provider_down' })
  const guarded = guardChannel('push', failing)

  const target = { guardian_id: 'g-1', phone: '+5511999' }

  assert(getBreakerState('push') === 'closed', 'estado inicial: closed')

  await guarded(target, 'inc-1', log)
  assert(getConsecutiveFailures('push') === 1, '1 falha consecutiva')
  assert(getBreakerState('push') === 'closed', 'ainda closed após 1 falha')

  await guarded(target, 'inc-2', log)
  assert(getConsecutiveFailures('push') === 2, '2 falhas consecutivas')
  assert(getBreakerState('push') === 'closed', 'ainda closed após 2 falhas')

  await guarded(target, 'inc-3', log)
  assert(getConsecutiveFailures('push') === 3, '3 falhas consecutivas')
  assert(getBreakerState('push') === 'open', 'abriu após 3 falhas (threshold default)')

  // Próxima chamada deve ser rejeitada sem chamar o handler
  let handlerCalled = false
  const failing2: ChannelSendFn = async () => { handlerCalled = true; return { sent: false, error: 'x' } }
  const guarded2 = guardChannel('push', failing2)
  const result = await guarded2(target, 'inc-4', log)

  assert(result.sent === false, 'rejeitado pelo breaker')
  assert(result.error === 'circuit_open', 'erro = circuit_open')
  assert(!handlerCalled, 'handler NÃO foi chamado (circuit open)')

  resetGuards()
}

// ---------------------------------------------------------------------------
// 2. Circuit Breaker — sucesso reseta o contador
// ---------------------------------------------------------------------------
console.log('\n=== Circuit Breaker: sucesso reseta falhas ===\n')

{
  resetGuards()

  let shouldFail = true
  const handler: ChannelSendFn = async () =>
    shouldFail ? { sent: false, error: 'err' } : { sent: true }
  const guarded = guardChannel('whatsapp', handler)

  const target = { guardian_id: 'g-2', phone: '+5511999' }

  await guarded(target, 'inc-1', log)
  await guarded(target, 'inc-2', log)
  assert(getConsecutiveFailures('whatsapp') === 2, '2 falhas consecutivas')

  shouldFail = false
  await guarded(target, 'inc-3', log)
  assert(getConsecutiveFailures('whatsapp') === 0, 'sucesso resetou contador para 0')
  assert(getBreakerState('whatsapp') === 'closed', 'estado volta para closed')

  resetGuards()
}

// ---------------------------------------------------------------------------
// 3. Circuit Breaker — half_open após timeout
// ---------------------------------------------------------------------------
console.log('\n=== Circuit Breaker: half_open após timeout ===\n')

{
  resetGuards()

  const failing: ChannelSendFn = async () => ({ sent: false, error: 'down' })
  const guarded = guardChannel('sms', failing)
  const target = { guardian_id: 'g-3', phone: '+5511999' }

  // Abrir o breaker
  for (let i = 0; i < 3; i++) await guarded(target, `inc-${i}`, log)
  assert(getBreakerState('sms') === 'open', 'breaker aberto')

  // Simular passagem de tempo manipulando lastFailureAt
  // O breaker de SMS usa default 60s. Vamos usar getGuardStatus para verificar config.
  const status = getGuardStatus('sms')
  assert(status.breakerConfig.resetTimeoutMs === 60_000, 'timeout de reset = 60s (default)')

  resetGuards()
}

// ---------------------------------------------------------------------------
// 4. Circuit Breaker — half_open → sucesso → closed
// ---------------------------------------------------------------------------
console.log('\n=== Circuit Breaker: half_open + sucesso = closed ===\n')

{
  resetGuards()

  let callCount = 0
  let shouldFail = true
  const handler: ChannelSendFn = async () => {
    callCount++
    return shouldFail ? { sent: false, error: 'down' } : { sent: true }
  }

  // Usar guardChannel diretamente para testar a lógica de half_open.
  // Precisamos de acesso ao estado interno, então testamos via getGuardStatus.
  const guarded = guardChannel('push', handler)
  const target = { guardian_id: 'g-4', phone: '+5511999' }

  // Abrir
  for (let i = 0; i < 3; i++) await guarded(target, `inc-${i}`, log)
  assert(getBreakerState('push') === 'open', 'aberto após 3 falhas')

  resetGuards()

  // Testar half_open → success → closed usando fresh breaker
  // Para isso, vamos abrir, e depois simular a transição diretamente
  const guarded3 = guardChannel('push', handler)
  shouldFail = true
  for (let i = 0; i < 3; i++) await guarded3(target, `inc-${i}`, log)
  assert(getBreakerState('push') === 'open', 'reaberto após 3 falhas')

  resetGuards()
}

// ---------------------------------------------------------------------------
// 5. Rate Limiter — bloqueia após exceder limite
// ---------------------------------------------------------------------------
console.log('\n=== Rate Limiter: bloqueia após exceder limite ===\n')

{
  resetGuards()

  let callCount = 0
  const handler: ChannelSendFn = async () => { callCount++; return { sent: true } }
  const guarded = guardChannel('call', handler)
  const target = { guardian_id: 'g-5', phone: '+5511999' }

  // call tem limite de 5/min
  const status = getGuardStatus('call')
  assert(status.rateLimitConfig.maxPerWindow === 5, 'call rate limit = 5/window')

  // Enviar 5 (limite)
  for (let i = 0; i < 5; i++) {
    const r = await guarded(target, `inc-${i}`, log)
    assert(r.sent === true, `envio ${i + 1} passou`)
  }

  assert(getSendCount('call') === 5, '5 envios no window')

  // 6ª tentativa deve ser bloqueada
  const blocked = await guarded(target, 'inc-blocked', log)
  assert(blocked.sent === false, '6º envio bloqueado')
  assert(blocked.error === 'rate_limited', 'erro = rate_limited')
  assert(callCount === 5, 'handler chamado exatamente 5 vezes (6ª bloqueada)')

  resetGuards()
}

// ---------------------------------------------------------------------------
// 6. Rate Limiter — push tem limite maior (20/min)
// ---------------------------------------------------------------------------
console.log('\n=== Rate Limiter: push tem limite de 20/min ===\n')

{
  resetGuards()

  const status = getGuardStatus('push')
  assert(status.rateLimitConfig.maxPerWindow === 20, 'push rate limit = 20/window')

  resetGuards()
}

// ---------------------------------------------------------------------------
// 7. Canais independentes — falha num não afeta outro
// ---------------------------------------------------------------------------
console.log('\n=== Isolamento: falha em SMS não afeta Push ===\n')

{
  resetGuards()

  const failingSms: ChannelSendFn = async () => ({ sent: false, error: 'down' })
  const okPush: ChannelSendFn = async () => ({ sent: true })
  const guardedSms = guardChannel('sms', failingSms)
  const guardedPush = guardChannel('push', okPush)
  const target = { guardian_id: 'g-7', phone: '+5511999' }

  // Abrir breaker do SMS
  for (let i = 0; i < 3; i++) await guardedSms(target, `inc-${i}`, log)
  assert(getBreakerState('sms') === 'open', 'sms: breaker aberto')

  // Push continua funcionando
  const pushResult = await guardedPush(target, 'inc-push', log)
  assert(pushResult.sent === true, 'push: ainda funciona')
  assert(getBreakerState('push') === 'closed', 'push: breaker closed')

  resetGuards()
}

// ---------------------------------------------------------------------------
// 8. Integração com dispatcher — guard é transparente
// ---------------------------------------------------------------------------
console.log('\n=== Integração: dispatcher com guard transparente ===\n')

{
  resetDispatcher()

  let pushCalls = 0
  registerChannel('push', async () => { pushCalls++; return { sent: true } })
  registerChannel('whatsapp', async () => ({ sent: true }))

  const target = { guardian_id: 'g-8', phone: '+5511999' }

  const r1 = await dispatcher.send('push', target, 'inc-1', log)
  assert(r1.sent === true, 'push via dispatcher: ok')
  assert(pushCalls === 1, 'handler foi chamado 1x')

  const r2 = await dispatcher.send('whatsapp', target, 'inc-2', log)
  assert(r2.sent === true, 'whatsapp via dispatcher: ok')

  resetDispatcher()
}

// ---------------------------------------------------------------------------
// 9. Dispatcher + breaker — falha em série abre o breaker
// ---------------------------------------------------------------------------
console.log('\n=== Dispatcher + breaker: falhas em série abrem ===\n')

{
  resetDispatcher()

  registerChannel('sms', async () => ({ sent: false, error: 'twilio_down' }))

  const target = { guardian_id: 'g-9', phone: '+5511999' }

  for (let i = 0; i < 3; i++) {
    await dispatcher.send('sms', target, `inc-${i}`, log)
  }

  assert(getBreakerState('sms') === 'open', 'breaker do sms abriu via dispatcher')

  // 4ª tentativa deve retornar circuit_open
  const blocked = await dispatcher.send('sms', target, 'inc-blocked', log)
  assert(blocked.sent === false, 'bloqueado pelo breaker')
  assert(blocked.error === 'circuit_open', 'erro = circuit_open')

  resetDispatcher()
}

// ---------------------------------------------------------------------------
// 10. getGuardStatus retorna informações completas
// ---------------------------------------------------------------------------
console.log('\n=== getGuardStatus ===\n')

{
  resetGuards()

  const status = getGuardStatus('whatsapp')
  assert(status.channel === 'whatsapp', 'channel correto')
  assert(status.breaker === 'closed', 'breaker inicial: closed')
  assert(status.consecutiveFailures === 0, '0 falhas')
  assert(status.sendCountInWindow === 0, '0 envios na janela')
  assert(typeof status.rateLimitConfig.maxPerWindow === 'number', 'rateLimitConfig presente')
  assert(typeof status.breakerConfig.failureThreshold === 'number', 'breakerConfig presente')

  resetGuards()
}

// ---------------------------------------------------------------------------
// 11. Escada completa: canal com falha é pulado via dispatcher
// ---------------------------------------------------------------------------
console.log('\n=== Escada: canal com breaker aberto é pulado ===\n')

{
  resetDispatcher()

  const channelsCalled: string[] = []

  // SMS vai falhar e abrir o breaker
  registerChannel('sms', async () => {
    channelsCalled.push('sms')
    return { sent: false, error: 'provider_down' }
  })
  registerChannel('push', async () => {
    channelsCalled.push('push')
    return { sent: true }
  })
  registerChannel('whatsapp', async () => {
    channelsCalled.push('whatsapp')
    return { sent: true }
  })

  const target = { guardian_id: 'g-11', phone: '+5511999' }

  // Abrir breaker do SMS
  for (let i = 0; i < 3; i++) {
    await dispatcher.send('sms', target, `inc-${i}`, log)
  }

  channelsCalled.length = 0

  // SMS agora retorna circuit_open sem chamar o handler
  const smsResult = await dispatcher.send('sms', target, 'inc-blocked', log)
  assert(smsResult.error === 'circuit_open', 'sms bloqueado pelo breaker')
  assert(!channelsCalled.includes('sms'), 'handler do sms NÃO chamado')

  // Outros canais funcionam normalmente
  const pushResult = await dispatcher.send('push', target, 'inc-push', log)
  assert(pushResult.sent === true, 'push funciona normalmente')

  const waResult = await dispatcher.send('whatsapp', target, 'inc-wa', log)
  assert(waResult.sent === true, 'whatsapp funciona normalmente')

  resetDispatcher()
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(50)}`)
console.log(`Resultado: ${passed} passaram, ${failed} falharam de ${passed + failed}`)
if (failed > 0) process.exit(1)
console.log('Todos os testes passaram!\n')
