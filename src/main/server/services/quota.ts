import type { QuotaStatus } from '@shared/types'
import type { ProviderConfig } from '@shared/types'
import { saveQuotaLog, getQuotaForProvider } from '../db/index'

const degradedProviders = new Map<string, { until: number; reason: string }>()

function degradedKey(userId: string, provider: string): string {
  return `${userId}:${provider}`
}

export function markDegraded(userId: string, provider: string, reason: string, durationMs = 30_000): void {
  degradedProviders.set(degradedKey(userId, provider), { until: Date.now() + durationMs, reason })
}

export function recordUsage(
  userId: string,
  provider: string,
  tokensIn: number,
  tokensOut: number
): void {
  const now = new Date()
  const windowMinute = now.toISOString().slice(0, 16) + ':00Z'
  const windowDay = now.toISOString().slice(0, 10)

  saveQuotaLog(userId, provider, 1, tokensIn, tokensOut, windowMinute, windowDay)
}

export function getQuotaStatus(userId: string, configs: ProviderConfig[]): QuotaStatus[] {
  return configs.map((cfg) => {
    const usage = getQuotaForProvider(userId, cfg.name)
    const key = degradedKey(userId, cfg.name)
    const degraded = degradedProviders.get(key)
    const isDegraded = degraded !== undefined && degraded.until > Date.now()

    if (degraded && degraded.until <= Date.now()) {
      degradedProviders.delete(key)
    }

    return {
      provider: cfg.name,
      rpmRemaining: Math.max(0, cfg.rpmLimit - usage.minuteRequests),
      rpmLimit: cfg.rpmLimit,
      tpmRemaining: Math.max(0, cfg.tpmLimit - usage.minuteTokens),
      tpmLimit: cfg.tpmLimit,
      dailyTokensRemaining: Math.max(0, cfg.dailyTokenLimit - usage.dayTokensIn),
      dailyTokenLimit: cfg.dailyTokenLimit,
      dailyRequestsRemaining: cfg.dailyRequestLimit !== undefined ? Math.max(0, cfg.dailyRequestLimit - usage.dayRequests) : undefined,
      dailyRequestLimit: cfg.dailyRequestLimit,
      degraded: isDegraded,
      lastError: isDegraded ? degraded?.reason : undefined
    }
  })
}

export function getBestAvailableModel(
  config: ProviderConfig,
  intent: string
): string {
  const models = config.models

  if (intent === 'long_doc') {
    const sorted = [...models].sort((a, b) => b.contextWindow - a.contextWindow)
    return sorted[0].id
  }

  const scored = models.map((m) => {
    let score = m.strengths.includes(intent as any) ? 1 : 0
    // For coding/agent tasks, prefer models that support tool use (function calling)
    if (intent === 'code' && m.capabilities?.includes('tool_use')) score += 0.5
    return { id: m.id, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.id || models[0].id
}
