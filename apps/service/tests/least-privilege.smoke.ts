import { createScopedDb } from '../src/shared/db/scoped.js'

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

function assertThrows(fn: () => void, label: string) {
  try {
    fn()
    failed++
    console.error(`  ✗ ${label} (expected throw)`)
  } catch {
    passed++
    console.log(`  ✓ ${label}`)
  }
}

// ── Gateway ─────────────────────────────────────────────────────────────────

console.log('=== gateway scope ===')

const gw = createScopedDb('gateway', {
  tables: ['protected_persons'],
  allowVault: true,
})

assert(typeof gw.from('protected_persons') === 'object', 'acessa protected_persons')
assertThrows(() => gw.from('risk_events'), 'NÃO acessa risk_events')
assertThrows(() => gw.from('incidents'), 'NÃO acessa incidents')
assertThrows(() => gw.from('guardians'), 'NÃO acessa guardians')
assertThrows(() => gw.from('simulations'), 'NÃO acessa simulations')

assert(typeof gw.schema('vault_baileys' as any) === 'object', 'acessa vault_baileys')

// ── Risk Worker ─────────────────────────────────────────────────────────────

console.log('\n=== risk_worker scope ===')

const rw = createScopedDb('risk_worker', {
  tables: ['risk_events'],
})

assert(typeof rw.from('risk_events') === 'object', 'acessa risk_events')
assertThrows(() => rw.from('protected_persons'), 'NÃO acessa protected_persons')
assertThrows(() => rw.from('incidents'), 'NÃO acessa incidents')
assertThrows(() => rw.from('guardians'), 'NÃO acessa guardians')
assertThrows(() => rw.from('simulations'), 'NÃO acessa simulations')

assertThrows(() => rw.schema('vault_baileys' as any), 'NÃO acessa vault_baileys')

// ── Orchestrator ────────────────────────────────────────────────────────────

console.log('\n=== orchestrator scope ===')

const orch = createScopedDb('orchestrator', {
  tables: ['incidents', 'incident_deliveries', 'risk_events', 'guardian_links', 'guardians', 'protected_persons'],
})

assert(typeof orch.from('incidents') === 'object', 'acessa incidents')
assert(typeof orch.from('incident_deliveries') === 'object', 'acessa incident_deliveries')
assert(typeof orch.from('risk_events') === 'object', 'acessa risk_events')
assert(typeof orch.from('guardian_links') === 'object', 'acessa guardian_links')
assert(typeof orch.from('guardians') === 'object', 'acessa guardians')
assert(typeof orch.from('protected_persons') === 'object', 'acessa protected_persons')
assertThrows(() => orch.from('simulations'), 'NÃO acessa simulations')

assertThrows(() => orch.schema('vault_baileys' as any), 'NÃO acessa vault_baileys')

// ── Simulation ──────────────────────────────────────────────────────────────

console.log('\n=== simulation scope ===')

const sim = createScopedDb('simulation', {
  tables: ['simulations', 'protected_persons'],
})

assert(typeof sim.from('simulations') === 'object', 'acessa simulations')
assert(typeof sim.from('protected_persons') === 'object', 'acessa protected_persons')
assertThrows(() => sim.from('incidents'), 'NÃO acessa incidents')
assertThrows(() => sim.from('risk_events'), 'NÃO acessa risk_events')
assertThrows(() => sim.from('guardians'), 'NÃO acessa guardians')

assertThrows(() => sim.schema('vault_baileys' as any), 'NÃO acessa vault_baileys')

// ── Verification ────────────────────────────────────────────────────────────

console.log('\n=== verification scope ===')

const ver = createScopedDb('verification', {
  tables: ['protected_persons', 'simulations'],
})

assert(typeof ver.from('protected_persons') === 'object', 'acessa protected_persons')
assert(typeof ver.from('simulations') === 'object', 'acessa simulations')
assertThrows(() => ver.from('incidents'), 'NÃO acessa incidents')
assertThrows(() => ver.from('risk_events'), 'NÃO acessa risk_events')
assertThrows(() => ver.from('guardians'), 'NÃO acessa guardians')

assertThrows(() => ver.schema('vault_baileys' as any), 'NÃO acessa vault_baileys')

// ── Introspection helpers ───────────────────────────────────────────────────

console.log('\n=== introspection ===')

assert((gw as any)._scopeRole === 'gateway', 'gateway _scopeRole')
assert((rw as any)._scopeRole === 'risk_worker', 'risk_worker _scopeRole')
assert((orch as any)._scopeRole === 'orchestrator', 'orchestrator _scopeRole')
assert((gw as any)._scopeAllowVault === true, 'gateway allowVault=true')
assert((rw as any)._scopeAllowVault === false, 'risk_worker allowVault=false')

const rwTables: string[] = (rw as any)._scopeTables
assert(rwTables.length === 1, 'risk_worker has 1 table')
assert(rwTables[0] === 'risk_events', 'risk_worker table is risk_events')

// ── Error messages are clear ────────────────────────────────────────────────

console.log('\n=== error messages ===')

try {
  rw.from('incidents')
} catch (e) {
  const msg = (e as Error).message
  assert(msg.includes('[risk_worker]'), 'error message includes role name')
  assert(msg.includes('incidents'), 'error message includes attempted table')
  assert(msg.includes('risk_events'), 'error message includes allowed tables')
}

try {
  rw.schema('vault_baileys' as any)
} catch (e) {
  const msg = (e as Error).message
  assert(msg.includes('[risk_worker]'), 'vault error includes role name')
  assert(msg.includes('vault_baileys'), 'vault error includes schema name')
}

// ── rpc passthrough works ───────────────────────────────────────────────────

console.log('\n=== rpc passthrough ===')

assert(typeof rw.rpc === 'function', 'rpc method is available')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)
