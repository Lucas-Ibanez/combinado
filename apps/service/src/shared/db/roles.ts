import { createScopedDb } from './scoped.js'

export const gatewayDb = createScopedDb('gateway', {
  tables: ['protected_persons'],
  allowVault: true,
})

export const riskDb = createScopedDb('risk_worker', {
  tables: ['risk_events'],
})

export const orchestratorDb = createScopedDb('orchestrator', {
  tables: [
    'incidents',
    'incident_deliveries',
    'risk_events',
    'guardian_links',
    'guardians',
    'protected_persons',
  ],
})

export const simulationDb = createScopedDb('simulation', {
  tables: ['simulations', 'protected_persons'],
})

export const verificationDb = createScopedDb('verification', {
  tables: ['protected_persons', 'simulations'],
})
