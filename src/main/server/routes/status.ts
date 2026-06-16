import { Router } from 'express'
import { getDb } from '../db/index'
import { getTokensOptimized } from '../services/metrics'
import { getEnabledProviders } from '../services/providers/registry'
import { getQuotaStatus } from '../services/quota'
import { hasApiKey } from '../services/apiKeys'
import type { AuthedRequest } from '../middleware/requireAuth'

export const statusRouter = Router()

statusRouter.get('/', (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!
    const d = getDb()
    const tokenRow = d.prepare(
      "SELECT COALESCE(SUM(tokens_in + tokens_out), 0) as total FROM quota_log WHERE user_id = ?"
    ).get(userId) as { total: number }

    const requestRow = d.prepare(
      "SELECT COALESCE(SUM(requests), 0) as total FROM quota_log WHERE user_id = ?"
    ).get(userId) as { total: number }

    const tokensSaved = tokenRow.total
    const avgRate = 0.005
    const costAvoided = (tokensSaved / 1000) * avgRate

    const tokensOptimized = getTokensOptimized()

    // Daily token headroom across the providers the user actually has keys for.
    const providers = getEnabledProviders()
    const withKeys = providers.filter((p) => hasApiKey(userId, p))
    const quotaStatuses = getQuotaStatus(userId, withKeys)
    const tokenCapacityRemaining = quotaStatuses.reduce((sum, q) => sum + q.dailyTokensRemaining, 0)
    const tokenCapacityTotal = withKeys.reduce((sum, p) => sum + p.dailyTokenLimit, 0)
    const providersAvailable = withKeys.length
    const modelsAvailable = withKeys.reduce((sum, p) => sum + p.models.length, 0)

    res.json({
      totalTokens: tokensSaved,
      totalRequests: requestRow.total,
      costAvoided: Math.round(costAvoided * 100) / 100,
      tokensOptimized,
      tokenCapacityRemaining,
      tokenCapacityTotal,
      providersAvailable,
      modelsAvailable
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
