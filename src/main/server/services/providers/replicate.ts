import { ProviderAdapter, normalizeError } from './adapter'
import type { CompletionRequest, CompletionResponse, ProviderConfig } from '@shared/types'

export class ReplicateAdapter extends ProviderAdapter {
  readonly config: ProviderConfig

  constructor(config: ProviderConfig, apiKey?: string) {
    super(apiKey)
    this.config = config
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now()
    const model = req.model || this.config.models[0].id
    const apiKey = this.getApiKey()
    const prompt = req.messages.map((m) => m.content).join('\n')

    // `Prefer: wait` makes Replicate block and return the finished prediction
    // synchronously (works for fast models like flux-schnell), so no polling loop is needed.
    const response = await fetch(`${this.config.baseUrl}/models/${model}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({ input: { prompt } })
    })

    if (!response.ok) {
      const text = await response.text()
      const { status, message } = normalizeError({ status: response.status, message: text })
      throw Object.assign(new Error(message), { status })
    }

    const json = await response.json() as { output?: string | string[]; error?: string; status?: string }
    if (json.status === 'failed' || json.error) {
      throw new Error(json.error || 'Replicate prediction failed')
    }

    const imageUrl = Array.isArray(json.output) ? json.output[0] : json.output

    return {
      content: `Generated image: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`,
      model,
      provider: this.config.name,
      tokensIn: prompt.length,
      tokensOut: 0,
      finishReason: 'stop',
      latencyMs: Date.now() - start,
      imageUrl
    }
  }
}
