// Smoke test para PushChannel — valida lógica de validação de subscription,
// fallback sem VAPID, e integração com dispatcher.

import { PushChannel, _isValidSubscriptionForTest as isValid } from '../src/orchestrator/channels/push.js'
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
// Validação de PushSubscription
// ---------------------------------------------------------------------------
console.log('\n=== Validação de PushSubscription ===\n')

assert(isValid(null) === false, 'null é inválido')
assert(isValid(undefined) === false, 'undefined é inválido')
assert(isValid('string') === false, 'string é inválido')
assert(isValid(42) === false, 'número é inválido')
assert(isValid({}) === false, 'objeto vazio é inválido')
assert(isValid({ endpoint: '' }) === false, 'endpoint vazio é inválido')
assert(isValid({ endpoint: 'https://fcm.googleapis.com/...' }) === false, 'sem keys é inválido')
assert(
  isValid({ endpoint: 'https://fcm.googleapis.com/...', keys: {} }) === false,
  'keys vazio é inválido',
)
assert(
  isValid({ endpoint: 'https://fcm.googleapis.com/...', keys: { p256dh: 'abc' } }) === false,
  'sem auth é inválido',
)
assert(
  isValid({
    endpoint: 'https://fcm.googleapis.com/...',
    keys: { p256dh: 'abc', auth: 'def' },
  }) === true,
  'subscription completa é válida',
)

// ---------------------------------------------------------------------------
// PushChannel — sem VAPID configurado
// ---------------------------------------------------------------------------
console.log('\n=== PushChannel sem VAPID ===\n')

{
  const channel = new PushChannel()
  const result = await channel.send(
    {
      guardian_id: 'g-1',
      phone: '+5511999887766',
      push_subscription: {
        endpoint: 'https://fcm.googleapis.com/...',
        keys: { p256dh: 'abc', auth: 'def' },
      },
    },
    'inc-001',
    log,
  )

  assert(result.sent === false, 'retorna sent: false sem VAPID')
  assert(result.error === 'vapid_not_configured', 'erro correto')
}

// ---------------------------------------------------------------------------
// PushChannel — sem push_subscription
// ---------------------------------------------------------------------------
console.log('\n=== PushChannel sem subscription ===\n')

{
  // Usando dispatcher mock para simular a lógica sem precisar de VAPID
  _resetDispatcherForTest()
  registerChannel('push', async (target, _incidentId, _log) => {
    if (!target.push_subscription || typeof target.push_subscription !== 'object') {
      return { sent: false, error: 'no_push_subscription' }
    }
    return { sent: true }
  })

  const result = await dispatcher.send(
    'push',
    { guardian_id: 'g-2', phone: '+5511999887766', push_subscription: null },
    'inc-002',
    log,
  )

  assert(result.sent === false, 'retorna sent: false sem subscription')
  assert(result.error === 'no_push_subscription', 'erro correto para no_push_subscription')

  _resetDispatcherForTest()
}

// ---------------------------------------------------------------------------
// PushChannel — subscription inválida
// ---------------------------------------------------------------------------
console.log('\n=== PushChannel com subscription inválida ===\n')

{
  _resetDispatcherForTest()
  const channel = new PushChannel()

  // subscription sem keys
  const result = await channel.send(
    {
      guardian_id: 'g-3',
      phone: '+5511999887766',
      push_subscription: { endpoint: 'https://invalid' },
    },
    'inc-003',
    log,
  )

  assert(result.sent === false, 'subscription incompleta retorna sent: false')
  assert(result.error === 'vapid_not_configured', 'sem VAPID, guard de config dispara antes da validação de subscription')

  _resetDispatcherForTest()
}

// ---------------------------------------------------------------------------
// Dispatcher integration — push mock
// ---------------------------------------------------------------------------
console.log('\n=== registerChannel("push") + dispatcher ===\n')

{
  _resetDispatcherForTest()

  let sendCalled = false
  registerChannel('push', async (target, incidentId, channelLog) => {
    sendCalled = true
    channelLog.info('push mock: notificação simulada', {
      guardian_id: target.guardian_id,
      incident_id: incidentId,
    })
    return { sent: true }
  })

  const result = await dispatcher.send(
    'push',
    {
      guardian_id: 'g-4',
      phone: '+5511888776655',
      push_subscription: {
        endpoint: 'https://fcm.googleapis.com/mock',
        keys: { p256dh: 'test', auth: 'test' },
      },
    },
    'inc-004',
    log,
  )

  assert(sendCalled, 'dispatcher chamou o handler registrado')
  assert(result.sent === true, 'dispatcher retorna sent: true')

  _resetDispatcherForTest()
}

// ---------------------------------------------------------------------------
// DispatchTarget com push_subscription
// ---------------------------------------------------------------------------
console.log('\n=== DispatchTarget aceita push_subscription ===\n')

{
  _resetDispatcherForTest()

  let receivedSub: unknown = undefined
  registerChannel('push', async (target, _incidentId, _log) => {
    receivedSub = target.push_subscription
    return { sent: true }
  })

  const sub = {
    endpoint: 'https://fcm.googleapis.com/...',
    keys: { p256dh: 'p256', auth: 'auth' },
  }

  await dispatcher.send(
    'push',
    { guardian_id: 'g-5', push_subscription: sub },
    'inc-005',
    log,
  )

  assert(receivedSub === sub, 'push_subscription passa pelo dispatcher')

  _resetDispatcherForTest()
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(50)}`)
console.log(`Resultado: ${passed} passaram, ${failed} falharam de ${passed + failed}`)
if (failed > 0) process.exit(1)
console.log('Todos os testes passaram!\n')
