import { Router } from 'express'
import { getQuotaStatus } from '../services/quota'
import { getEnabledProviders } from '../services/providers/registry'
import type { AuthedRequest } from '../middleware/requireAuth'

export const quotaRouter = Router()

quotaRouter.get('/', (req: AuthedRequest, res) => {
  try {
    const providers = getEnabledProviders()
    const statuses = getQuotaStatus(req.userId!, providers)
    res.json(statuses)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
