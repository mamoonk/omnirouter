import { LOCAL_USER_ID, getApiKeyStatus as dbGetApiKeyStatus, setUserApiKey, getUserApiKeyEncrypted } from '../db/index'
import { encryptSecret, decryptSecret } from './crypto'
import * as envManager from './envManager'
import { PROVIDER_CONFIGS } from './providers/registry'
import type { ProviderConfig } from '@shared/types'

/**
 * Unifies the two key-storage strategies behind one interface:
 * - the desktop/Electron "local" user keeps using the existing `.env` file (envManager)
 * - every other (web) user gets per-account encrypted rows in the `api_keys` table
 *
 * Both sides speak in `apiKeyEnv` names (e.g. "GEMINI_API_KEY") over the wire/settings
 * UI, matching the existing desktop contract.
 */

export function getApiKeyStatus(userId: string): Record<string, boolean> {
  if (userId === LOCAL_USER_ID) return envManager.getApiKeyStatus()

  const stored = dbGetApiKeyStatus(userId)
  const result: Record<string, boolean> = {}
  for (const config of PROVIDER_CONFIGS) {
    result[config.apiKeyEnv] = Boolean(stored[config.apiKeyEnv])
  }
  return result
}

export function saveApiKeys(userId: string, keys: Record<string, string>): void {
  if (userId === LOCAL_USER_ID) {
    envManager.saveApiKeys(keys)
    return
  }

  for (const [apiKeyEnv, value] of Object.entries(keys)) {
    if (value) {
      setUserApiKey(userId, apiKeyEnv, encryptSecret(value))
    }
  }
}

/** Resolves the actual secret for a given provider's `apiKeyEnv`, or undefined if not set. */
export function resolveApiKey(userId: string, apiKeyEnv: string): string | undefined {
  if (userId === LOCAL_USER_ID) return process.env[apiKeyEnv]

  const encrypted = getUserApiKeyEncrypted(userId, apiKeyEnv)
  return encrypted ? decryptSecret(encrypted) : undefined
}

/** Keyless providers (e.g. Pollinations.ai) are always "available"; everyone else needs a resolved key. */
export function hasApiKey(userId: string, config: ProviderConfig): boolean {
  return config.noKeyRequired || Boolean(resolveApiKey(userId, config.apiKeyEnv))
}
