import { Router } from 'express'
import { getQuotaStatus } from '../services/quota'
import { getEnabledProviders } from '../services/providers/registry'
import { getDb } from '../db/index'

export const dashboardRouter = Router()

dashboardRouter.get('/', (_req, res) => {
  try {
    const providers = getEnabledProviders()
    const quotaStatuses = getQuotaStatus(providers)

    const d = getDb()
    const totalTokens = d.prepare(
      "SELECT COALESCE(SUM(tokens_in + tokens_out), 0) as total FROM quota_log"
    ).get() as { total: number }

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
