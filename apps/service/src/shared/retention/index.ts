import type { Logger } from '../logging/index.js'
import { db } from '../db/index.js'

export const RETENTION_DAYS = {
  RISK_EVENTS: 90,
  KEY_ACCESS_LOG: 30,
  EXPIRED_INVITES: 30,
  CLOSED_INCIDENTS: 365,
} as const

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6h

export function startRetentionCleanup(log: Logger): { stop(): void } {
  async function tick() {
    try {
      const { data, error } = await db.rpc('cleanup_expired_data' as any)
      if (error) {
        log.error('retention cleanup falhou', { error_name: error.message })
        return
      }
      const result = data as Record<string, number> | null
      const total = result
        ? Object.values(result).reduce((a, b) => a + b, 0)
        : 0

      if (total > 0) {
        log.info('retention cleanup executado', result ?? {})
      } else {
        log.debug('retention cleanup: nada a limpar')
      }
    } catch (err) {
      log.error('retention cleanup erro', {
        error_name: (err as Error).name,
      })
    }
  }

  void tick()
  const handle = setInterval(() => void tick(), CLEANUP_INTERVAL_MS)

  return {
    stop() {
      clearInterval(handle)
    },
  }
}

export function hasActiveSignals(signals: Record<string, unknown>): boolean {
  return Object.values(signals).some((v) => v === true)
}
