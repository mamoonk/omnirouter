import type { ProviderConfig, ProviderAdapter } from './adapter'
import { OpenAICompatibleAdapter } from './openai-compatible'
import { GeminiAdapter } from './gemini'
import { MistralAdapter } from './mistral'
import { CohereAdapter } from './cohere'
import { AnthropicAdapter } from './anthropic'
import { HuggingFaceAdapter } from './huggingface'
import { CloudflareAdapter } from './cloudflare'
import { AI21Adapter } from './ai21'
import { StabilityAdapter } from './stability'
import { ReplicateAdapter } from './replicate'
import { FalAiAdapter } from './falai'
import { PollinationsAdapter } from './pollinations'

const adapterCache = new Map<string, ProviderAdapter>()

/**
 * `apiKey` is supplied per-request for multi-tenant (web) callers who each have their
 * own key; those adapters are never cached. When omitted (desktop/Electron flow), the
 * adapter falls back to process.env and is cached as a singleton per provider.
 */
export function createAdapter(config: ProviderConfig, apiKey?: string): ProviderAdapter {
  if (!apiKey) {
    const cached = adapterCache.get(config.name)
    if (cached) return cached
  }

  let adapter: ProviderAdapter

  switch (config.adapter) {
    case 'native':
      switch (config.name) {
        case 'gemini':
          adapter = new GeminiAdapter(config, apiKey)
          break
        case 'mistral':
          adapter = new MistralAdapter(config, apiKey)
          break
        case 'cohere':
          adapter = new CohereAdapter(config, apiKey)
          break
        case 'anthropic':
          adapter = new AnthropicAdapter(config, apiKey)
          break
        case 'huggingface':
          adapter = new HuggingFaceAdapter(config, apiKey)
          break
        case 'cloudflare':
          adapter = new CloudflareAdapter(config, apiKey)
          break
        case 'ai21':
          adapter = new AI21Adapter(config, apiKey)
          break
        case 'stability':
          adapter = new StabilityAdapter(config, apiKey)
          break
        case 'replicate':
          adapter = new ReplicateAdapter(config, apiKey)
          break
        case 'falai':
          adapter = new FalAiAdapter(config, apiKey)
          break
        case 'pollinations':
          adapter = new PollinationsAdapter(config, apiKey)
          break
        default:
          adapter = new OpenAICompatibleAdapter(config, apiKey)
      }
      break
    case 'openai-compatible':
    default:
      adapter = new OpenAICompatibleAdapter(config, apiKey)
  }

  if (!apiKey) adapterCache.set(config.name, adapter)
  return adapter
}

export function getAdapter(name: string): ProviderAdapter | undefined {
  return adapterCache.get(name)
}
