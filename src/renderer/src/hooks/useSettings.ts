import { useState, useEffect, useCallback } from 'react'
import { ApiClient } from '../lib/api'
import type { Settings } from '@shared/types'

const DEFAULT_SETTINGS: Settings = {
  darkMode: false,
  showProviderBadge: true,
  streamingEnabled: true,
  cacheEnabled: true,
  compressionEnabled: true,
  routingStrategy: 'smart',
  debateEnabled: false,
  debateRounds: 1,
  providersEnabled: [],
  apiKeys: {}
}

export function useSettings(serverPort: number) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const api = new ApiClient(serverPort)
    api.getSettings()
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [serverPort])

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    const api = new ApiClient(serverPort)
    const updated = await api.updateSettings(partial)
    setSettings(updated)
  }, [serverPort])

  return { settings, updateSettings, loading }
}
