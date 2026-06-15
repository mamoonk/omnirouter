import type { QuotaStatus } from '@shared/types'
import type { ProviderConfig } from '@shared/types'
import { saveQuotaLog, getQuotaForProvider } from '../db/index'

const degradedProviders = new Map<string, { until: number; reason: string }>()

export function markDegraded(provider: string, reason: string, durationMs = 30_000): void {
  degradedProviders.set(provider, { until: Date.now() + durationMs, reason })
}

export function recordUsage(
  provider: string,
  tokensIn: number,
  tokensOut: number
): void {
  const now = new Date()
  const windowMinute = now.toISOString().slice(0, 16) + ':00Z'
  const windowDay = now.toISOString().slice(0, 10)

  saveQuotaLog(provider, 1, tokensIn, tokensOut, windowMinute, windowDay)
}

export function getQuotaStatus(configs: ProviderConfig[]): QuotaStatus[] {
  return configs.map((cfg) => {
    const usage = getQuotaForProvider(cfg.name)
    const degraded = degradedProviders.get(cfg.name)
    const isDegraded = degraded !== undefined && degraded.until > Date.now()

    if (degraded && degraded.until <= Date.now()) {
      degradedProviders.delete(cfg.name)
    }

    return {
      provider: cfg.name,
      rpmRemaining: Math.max(0, cfg.rpmLimit - usage.minuteRequests),
      rpmLimit: cfg.rpmLimit,
      tpmRemaining: Math.max(0, cfg.tpmLimit - usage.minuteTokens),
      tpmLimit: cfg.tpmLimit,
      dailyTokensRemaining: Math.max(0, cfg.dailyTokenLimit - usage.dayTokensIn),
      dailyTokenLimit: cfg.dailyTokenLimit,
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

  const scored = models.map((m) => ({
    id: m.id,
    score: m.strengths.includes(intent as any) ? 1 : 0
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.id || models[0].id
}
