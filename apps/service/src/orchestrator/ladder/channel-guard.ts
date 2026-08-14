import type { DeliveryChannel } from '@combinado/shared'
import type { ChannelSendFn } from './dispatch.js'

// ── Circuit Breaker ────────────────────────────────────────────────────────

type BreakerState = 'closed' | 'open' | 'half_open'

interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeoutMs: number
}

interface CircuitBreakerState {
  state: BreakerState
  consecutiveFailures: number
  lastFailureAt: number
}

const DEFAULT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
}

// ── Rate Limiter (sliding window) ──────────────────────────────────────────

interface RateLimitConfig {
  maxPerWindow: number
  windowMs: number
}

const DEFAULT_RATE: RateLimitConfig = {
  maxPerWindow: 10,
  windowMs: 60_000,
}

// ── Per-channel overrides ──────────────────────────────────────────────────

const CHANNEL_CONFIG: Partial<Record<DeliveryChannel, {
  breaker?: Partial<CircuitBreakerConfig>
  rate?: Partial<RateLimitConfig>
}>> = {
  push:     { rate: { maxPerWindow: 20 } },
  call:     { rate: { maxPerWindow: 5 }, breaker: { failureThreshold: 3, resetTimeoutMs: 120_000 } },
}

// ── Guard state ────────────────────────────────────────────────────────────

const breakers = new Map<DeliveryChannel, CircuitBreakerState>()
const sendTimestamps = new Map<DeliveryChannel, number[]>()

function getBreaker(channel: DeliveryChannel): CircuitBreakerState {
  let b = breakers.get(channel)
  if (!b) {
    b = { state: 'closed', consecutiveFailures: 0, lastFailureAt: 0 }
    breakers.set(channel, b)
  }
  return b
}

function getBreakerConfig(channel: DeliveryChannel): CircuitBreakerConfig {
  const override = CHANNEL_CONFIG[channel]?.breaker
  return { ...DEFAULT_BREAKER, ...override }
}

function getRateConfig(channel: DeliveryChannel): RateLimitConfig {
  const override = CHANNEL_CONFIG[channel]?.rate
  return { ...DEFAULT_RATE, ...override }
}

// ── Rate check ─────────────────────────────────────────────────────────────

function isRateLimited(channel: DeliveryChannel): boolean {
  const cfg = getRateConfig(channel)
  const now = Date.now()
  const cutoff = now - cfg.windowMs

  let timestamps = sendTimestamps.get(channel)
  if (!timestamps) {
    timestamps = []
    sendTimestamps.set(channel, timestamps)
  }

  // Prune old entries
  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift()
  }

  return timestamps.length >= cfg.maxPerWindow
}

function recordSendAttempt(channel: DeliveryChannel): void {
  let timestamps = sendTimestamps.get(channel)
  if (!timestamps) {
    timestamps = []
    sendTimestamps.set(channel, timestamps)
  }
  timestamps.push(Date.now())
}

// ── Breaker check ──────────────────────────────────────────────────────────

function shouldReject(channel: DeliveryChannel): boolean {
  const b = getBreaker(channel)
  const cfg = getBreakerConfig(channel)

  if (b.state === 'closed') return false

  if (b.state === 'open') {
    if (Date.now() - b.lastFailureAt >= cfg.resetTimeoutMs) {
      b.state = 'half_open'
      return false
    }
    return true
  }

  // half_open: allow one attempt
  return false
}

function recordSuccess(channel: DeliveryChannel): void {
  const b = getBreaker(channel)
  b.consecutiveFailures = 0
  b.state = 'closed'
}

function recordFailure(channel: DeliveryChannel): void {
  const b = getBreaker(channel)
  const cfg = getBreakerConfig(channel)

  b.consecutiveFailures++
  b.lastFailureAt = Date.now()

  if (b.state === 'half_open') {
    b.state = 'open'
    return
  }

  if (b.consecutiveFailures >= cfg.failureThreshold) {
    b.state = 'open'
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function guardChannel(channel: DeliveryChannel, handler: ChannelSendFn): ChannelSendFn {
  return async (target, incidentId, log) => {
    if (shouldReject(channel)) {
      log.warn('channel-guard: circuit breaker aberto', {
        channel,
        incident_id: incidentId,
        guardian_id: target.guardian_id,
      })
      return { sent: false, error: 'circuit_open' }
    }

    if (isRateLimited(channel)) {
      log.warn('channel-guard: rate limit atingido', {
        channel,
        incident_id: incidentId,
        guardian_id: target.guardian_id,
      })
      return { sent: false, error: 'rate_limited' }
    }

    recordSendAttempt(channel)

    const result = await handler(target, incidentId, log)

    if (result.sent) {
      recordSuccess(channel)
    } else {
      recordFailure(channel)
    }

    return result
  }
}

export interface ChannelGuardStatus {
  channel: DeliveryChannel
  breaker: BreakerState
  consecutiveFailures: number
  sendCountInWindow: number
  rateLimitConfig: RateLimitConfig
  breakerConfig: CircuitBreakerConfig
}

export function getGuardStatus(channel: DeliveryChannel): ChannelGuardStatus {
  const b = getBreaker(channel)
  const rateCfg = getRateConfig(channel)
  const brkCfg = getBreakerConfig(channel)

  const now = Date.now()
  const cutoff = now - rateCfg.windowMs
  const timestamps = sendTimestamps.get(channel) ?? []
  const recentCount = timestamps.filter((t) => t >= cutoff).length

  return {
    channel,
    breaker: b.state,
    consecutiveFailures: b.consecutiveFailures,
    sendCountInWindow: recentCount,
    rateLimitConfig: rateCfg,
    breakerConfig: brkCfg,
  }
}

// ── Test helpers ───────────────────────────────────────────────────────────

export function _resetGuardsForTest(): void {
  breakers.clear()
  sendTimestamps.clear()
}

export function _getBreakerStateForTest(channel: DeliveryChannel): BreakerState {
  return getBreaker(channel).state
}

export function _getConsecutiveFailuresForTest(channel: DeliveryChannel): number {
  return getBreaker(channel).consecutiveFailures
}

export function _getSendCountForTest(channel: DeliveryChannel): number {
  const rateCfg = getRateConfig(channel)
  const now = Date.now()
  const cutoff = now - rateCfg.windowMs
  const timestamps = sendTimestamps.get(channel) ?? []
  return timestamps.filter((t) => t >= cutoff).length
}
