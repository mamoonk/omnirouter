import { Router } from 'express'
import { getQuotaStatus } from '../services/quota'
import { getEnabledProviders } from '../services/providers/registry'

export const quotaRouter = Router()

quotaRouter.get('/', (_req, res) => {
  try {
    const providers = getEnabledProviders()
    const statuses = getQuotaStatus(providers)
    res.json(statuses)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
