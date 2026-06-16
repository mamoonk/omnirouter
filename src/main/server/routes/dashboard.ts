import { Router } from 'express'
import { getQuotaStatus } from '../services/quota'
import { getEnabledProviders } from '../services/providers/registry'
import { getDb } from '../db/index'
import type { AuthedRequest } from '../middleware/requireAuth'

export const dashboardRouter = Router()

dashboardRouter.get('/', (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!
    const providers = getEnabledProviders()
    const quotaStatuses = getQuotaStatus(userId, providers)

    const d = getDb()
    const totalTokens = d.prepare(
      "SELECT COALESCE(SUM(tokens_in + tokens_out), 0) as total FROM quota_log WHERE user_id = ?"
    ).get(userId) as { total: number }

    const gpt4Rate = 0.01
    const gpt4MiniRate = 0.00015
    const tokensSaved = totalTokens.total
    const costAvoided = (tokensSaved / 1000) * gpt4Rate

    res.json({
      quotaStatuses,
      savings: {
        tokensSaved,
        costAvoided
      },
      estimatedCosts: {
        gpt4: (tokensSaved / 1000) * gpt4Rate,
        gpt4Mini: (tokensSaved / 1000) * gpt4MiniRate
      }
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
