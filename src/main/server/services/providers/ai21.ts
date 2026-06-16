import { ProviderAdapter, normalizeError } from './adapter'
import type { CompletionRequest, CompletionResponse, ProviderConfig } from '@shared/types'

export class AI21Adapter extends ProviderAdapter {
  readonly config: ProviderConfig

  constructor(config: ProviderConfig, apiKey?: string) {
    super(apiKey)
    this.config = config
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now()
    const model = req.model || this.config.models[0].id
    const apiKey = this.getApiKey()

    try {
      const response = await fetch(`${this.config.baseUrl}/${model}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: req.maxTokens || 4096
        })
      })

      if (!response.ok) {
        const err = { status: response.status, message: response.statusText }
        throw new Error(JSON.stringify(err))
      }

      const data = await response.json() as any

      return {
        content: data.choices?.[0]?.message?.content || '',
        model,
        provider: this.config.name,
        tokensIn: data.usage?.prompt_tokens || 0,
        tokensOut: data.usage?.completion_tokens || 0,
        finishReason: 'stop',
        latencyMs: Date.now() - start
      }
    } catch (err) {
      try {
        const parsed = JSON.parse((err as Error).message)
        const { status, message } = normalizeError(parsed)
        throw Object.assign(new Error(message), { status })
      } catch {
        const { status, message } = normalizeError(err)
        throw Object.assign(new Error(message), { status })
      }
    }
  }
}
