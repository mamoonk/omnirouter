import { Router } from 'express'
import { getSetting, setSetting } from '../db/index'
import { getApiKeyStatus, saveApiKeys } from '../services/envManager'
import type { Settings } from '@shared/types'

export const settingsRouter = Router()

function loadSettings(): Settings {
  return {
    darkMode: getSetting('darkMode') === 'true',
    showProviderBadge: getSetting('showProviderBadge') !== 'false',
    streamingEnabled: getSetting('streamingEnabled') !== 'false',
    cacheEnabled: getSetting('cacheEnabled') !== 'false',
    compressionEnabled: getSetting('compressionEnabled') !== 'false',
    tokenOptimization: getSetting('tokenOptimization') !== 'false',
    tokenOptimizationThreshold: parseInt(getSetting('tokenOptimizationThreshold') || '70', 10),
    routingStrategy: (getSetting('routingStrategy') as Settings['routingStrategy']) || 'smart',
    debateEnabled: getSetting('debateEnabled') === 'true',
    debateRounds: parseInt(getSetting('debateRounds') || '1', 10),
    debatePrimaryProvider: getSetting('debatePrimaryProvider') || undefined,
    debateCriticProvider: getSetting('debateCriticProvider') || undefined,
    providersEnabled: [],
    apiKeys: {}
  }
}

settingsRouter.get('/', (_req, res) => {
  try {
    const settings = loadSettings()
    res.json(settings)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

settingsRouter.put('/', (req, res) => {
  try {
    const updates = req.body as Partial<Settings>

    if (updates.darkMode !== undefined) setSetting('darkMode', String(updates.darkMode))
    if (updates.showProviderBadge !== undefined) setSetting('showProviderBadge', String(updates.showProviderBadge))
    if (updates.streamingEnabled !== undefined) setSetting('streamingEnabled', String(updates.streamingEnabled))
    if (updates.cacheEnabled !== undefined) setSetting('cacheEnabled', String(updates.cacheEnabled))
    if (updates.compressionEnabled !== undefined) setSetting('compressionEnabled', String(updates.compressionEnabled))
    if (updates.tokenOptimization !== undefined) setSetting('tokenOptimization', String(updates.tokenOptimization))
    if (updates.tokenOptimizationThreshold !== undefined) setSetting('tokenOptimizationThreshold', String(updates.tokenOptimizationThreshold))
    if (updates.routingStrategy !== undefined) setSetting('routingStrategy', updates.routingStrategy)
    if (updates.debateEnabled !== undefined) setSetting('debateEnabled', String(updates.debateEnabled))
    if (updates.debateRounds !== undefined) setSetting('debateRounds', String(updates.debateRounds))
    if (updates.debatePrimaryProvider !== undefined) setSetting('debatePrimaryProvider', updates.debatePrimaryProvider || '')
    if (updates.debateCriticProvider !== undefined) setSetting('debateCriticProvider', updates.debateCriticProvider || '')

    const settings = loadSettings()
    res.json(settings)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

settingsRouter.get('/keys', (_req, res) => {
  try {
    const statuses = getApiKeyStatus()
    res.json(statuses)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

settingsRouter.put('/keys', (req, res) => {
  try {
    const keys = req.body as Record<string, string>
    saveApiKeys(keys)
    const statuses = getApiKeyStatus()
    res.json(statuses)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
