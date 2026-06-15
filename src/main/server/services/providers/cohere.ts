import { CohereClient } from 'cohere-ai'
import { ProviderAdapter, normalizeError } from './adapter'
import type { CompletionRequest, CompletionResponse, ProviderConfig } from '@shared/types'

export class CohereAdapter extends ProviderAdapter {
  readonly config: ProviderConfig
  private client: CohereClient

  constructor(config: ProviderConfig) {
    super()
    this.config = config
    this.client = new CohereClient({ token: this.getApiKey() })
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now()
    const model = req.model || this.config.models[0].id

    try {
      const lastMsg = req.messages[req.messages.length - 1]
      const response = await this.client.chat({
        model,
        message: lastMsg.content,
        chatHistory: req.messages.slice(0, -1).map((m) => ({
          role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
          message: m.content
        }))
      })

      return {
        content: response.text,
        model,
        provider: this.config.name,
        tokensIn: response.meta?.billedUnits?.inputTokens || 0,
        tokensOut: response.meta?.billedUnits?.outputTokens || 0,
        finishReason: 'stop',
        latencyMs: Date.now() - start
      }
    } catch (err) {
      const { status, message } = normalizeError(err)
      throw Object.assign(new Error(message), { status })
    }
  }
}
