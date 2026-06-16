import Anthropic from '@anthropic-ai/sdk'
import { ProviderAdapter, normalizeError } from './adapter'
import type { CompletionRequest, CompletionResponse, ProviderConfig } from '@shared/types'

export class AnthropicAdapter extends ProviderAdapter {
  readonly config: ProviderConfig
  private client: Anthropic

  constructor(config: ProviderConfig, apiKey?: string) {
    super(apiKey)
    this.config = config
    this.client = new Anthropic({ apiKey: this.getApiKey() })
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now()
    const model = req.model || this.config.models[0].id

    try {
      const systemMsg = req.messages.find((m) => m.role === 'system')
      const nonSystemMessages = req.messages.filter((m) => m.role !== 'system')

      const response = await this.client.messages.create({
        model,
        max_tokens: req.maxTokens || 4096,
        system: systemMsg?.content,
        messages: nonSystemMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
      })

      const content = response.content.map((b) => (b as any).text || '').join('')

      return {
        content,
        model,
        provider: this.config.name,
        tokensIn: response.usage?.input_tokens || 0,
        tokensOut: response.usage?.output_tokens || 0,
        finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
        latencyMs: Date.now() - start
      }
    } catch (err) {
      const { status, message } = normalizeError(err)
      throw Object.assign(new Error(message), { status })
    }
  }
}
