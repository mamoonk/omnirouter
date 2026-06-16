import { Router } from 'express'
import { getSetting, setSetting } from '../db/index'
import { getApiKeyStatus, saveApiKeys } from '../services/apiKeys'
import type { Settings } from '@shared/types'
import type { AuthedRequest } from '../middleware/requireAuth'

export const settingsRouter = Router()

function loadSettings(userId: string): Settings {
  return {
    darkMode: getSetting(userId, 'darkMode') === 'true',
    showProviderBadge: getSetting(userId, 'showProviderBadge') !== 'false',
    streamingEnabled: getSetting(userId, 'streamingEnabled') !== 'false',
    cacheEnabled: getSetting(userId, 'cacheEnabled') !== 'false',
    compressionEnabled: getSetting(userId, 'compressionEnabled') !== 'false',
    tokenOptimization: getSetting(userId, 'tokenOptimization') !== 'false',
    tokenOptimizationThreshold: parseInt(getSetting(userId, 'tokenOptimizationThreshold') || '70', 10),
    routingStrategy: (getSetting(userId, 'routingStrategy') as Settings['routingStrategy']) || 'smart',
    debateEnabled: getSetting(userId, 'debateEnabled') === 'true',
    debateRounds: parseInt(getSetting(userId, 'debateRounds') || '1', 10),
    debatePrimaryProvider: getSetting(userId, 'debatePrimaryProvider') || undefined,
    debateCriticProvider: getSetting(userId, 'debateCriticProvider') || undefined,
    providersEnabled: [],
    apiKeys: {}
  }
}

settingsRouter.get('/', (req: AuthedRequest, res) => {
  try {
    const settings = loadSettings(req.userId!)
    res.json(settings)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

settingsRouter.put('/', (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!
    const updates = req.body as Partial<Settings>

    if (updates.darkMode !== undefined) setSetting(userId, 'darkMode', String(updates.darkMode))
    if (updates.showProviderBadge !== undefined) setSetting(userId, 'showProviderBadge', String(updates.showProviderBadge))
    if (updates.streamingEnabled !== undefined) setSetting(userId, 'streamingEnabled', String(updates.streamingEnabled))
    if (updates.cacheEnabled !== undefined) setSetting(userId, 'cacheEnabled', String(updates.cacheEnabled))
    if (updates.compressionEnabled !== undefined) setSetting(userId, 'compressionEnabled', String(updates.compressionEnabled))
    if (updates.tokenOptimization !== undefined) setSetting(userId, 'tokenOptimization', String(updates.tokenOptimization))
    if (updates.tokenOptimizationThreshold !== undefined) setSetting(userId, 'tokenOptimizationThreshold', String(updates.tokenOptimizationThreshold))
    if (updates.routingStrategy !== undefined) setSetting(userId, 'routingStrategy', updates.routingStrategy)
    if (updates.debateEnabled !== undefined) setSetting(userId, 'debateEnabled', String(updates.debateEnabled))
    if (updates.debateRounds !== undefined) setSetting(userId, 'debateRounds', String(updates.debateRounds))
    if (updates.debatePrimaryProvider !== undefined) setSetting(userId, 'debatePrimaryProvider', updates.debatePrimaryProvider || '')
    if (updates.debateCriticProvider !== undefined) setSetting(userId, 'debateCriticProvider', updates.debateCriticProvider || '')

    const settings = loadSettings(userId)
    res.json(settings)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

settingsRouter.get('/keys', (req: AuthedRequest, res) => {
  try {
    const statuses = getApiKeyStatus(req.userId!)
    res.json(statuses)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

settingsRouter.put('/keys', (req: AuthedRequest, res) => {
  try {
    const keys = req.body as Record<string, string>
    saveApiKeys(req.userId!, keys)
    const statuses = getApiKeyStatus(req.userId!)
    res.json(statuses)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
