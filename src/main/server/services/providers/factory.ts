import type { ProviderConfig, ProviderAdapter } from './adapter'
import { OpenAICompatibleAdapter } from './openai-compatible'
import { GeminiAdapter } from './gemini'
import { MistralAdapter } from './mistral'
import { CohereAdapter } from './cohere'
import { AnthropicAdapter } from './anthropic'
import { HuggingFaceAdapter } from './huggingface'
import { CloudflareAdapter } from './cloudflare'
import { AI21Adapter } from './ai21'

const adapterCache = new Map<string, ProviderAdapter>()

export function createAdapter(config: ProviderConfig): ProviderAdapter {
  const cached = adapterCache.get(config.name)
  if (cached) return cached

  let adapter: ProviderAdapter

  switch (config.adapter) {
    case 'native':
      switch (config.name) {
        case 'gemini':
          adapter = new GeminiAdapter(config)
          break
        case 'mistral':
          adapter = new MistralAdapter(config)
          break
        case 'cohere':
          adapter = new CohereAdapter(config)
          break
        case 'anthropic':
          adapter = new AnthropicAdapter(config)
          break
        case 'huggingface':
          adapter = new HuggingFaceAdapter(config)
          break
        case 'cloudflare':
          adapter = new CloudflareAdapter(config)
          break
        case 'ai21':
          adapter = new AI21Adapter(config)
          break
        default:
          adapter = new OpenAICompatibleAdapter(config)
      }
      break
    case 'openai-compatible':
    default:
      adapter = new OpenAICompatibleAdapter(config)
  }

  adapterCache.set(config.name, adapter)
  return adapter
}

export function getAdapter(name: string): ProviderAdapter | undefined {
  return adapterCache.get(name)
}
