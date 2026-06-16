import { Mistral } from '@mistralai/mistralai'
import { ProviderAdapter, normalizeError } from './adapter'
import type { CompletionRequest, CompletionResponse, ProviderConfig } from '@shared/types'

export class MistralAdapter extends ProviderAdapter {
  readonly config: ProviderConfig
  private client: Mistral

  constructor(config: ProviderConfig, apiKey?: string) {
    super(apiKey)
    this.config = config
    this.client = new Mistral({ apiKey: this.getApiKey() })
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now()
    const model = req.model || this.config.models[0].id

    try {
      const response = await this.client.chat.complete({
        model,
        messages: req.messages.map((m) => ({
          role: m.role,
          content: m.content
        }))
      })

      const choice = response.choices?.[0]

      return {
        content: choice?.message?.content || '',
        model,
        provider: this.config.name,
        tokensIn: response.usage?.promptTokens || 0,
        tokensOut: response.usage?.completionTokens || 0,
        finishReason: 'stop',
        latencyMs: Date.now() - start
      }
    } catch (err) {
      const { status, message } = normalizeError(err)
      throw Object.assign(new Error(message), { status })
    }
  }
}
