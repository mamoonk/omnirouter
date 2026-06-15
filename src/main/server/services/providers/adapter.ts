import type { CompletionRequest, CompletionResponse, ProviderConfig, ModelDef } from '@shared/types'

export type { ProviderConfig, ModelDef }

export abstract class ProviderAdapter {
  abstract readonly config: ProviderConfig

  abstract complete(req: CompletionRequest): Promise<CompletionResponse>

  getApiKey(): string {
    const key = process.env[this.config.apiKeyEnv]
    if (!key) throw new Error(`Missing API key: ${this.config.apiKeyEnv}`)
    return key
  }

  estimateTokens(content: string): number {
    return Math.ceil(content.length / 4)
  }
}

export function normalizeError(err: unknown): { status: number; message: string } {
  if (err && typeof err === 'object') {
    const e = err as any
    if (e.status === 429 || e.statusCode === 429 || e.response?.status === 429) {
      return { status: 429, message: 'Rate limited' }
    }
    if (e.status === 500 || e.statusCode === 500) {
      return { status: 500, message: e.message || 'Provider error' }
    }
    return { status: 500, message: e.message || 'Unknown error' }
  }
  return { status: 500, message: String(err) }
}
