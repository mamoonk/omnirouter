import { ProviderAdapter, normalizeError } from './adapter'
import type { CompletionRequest, CompletionResponse, ProviderConfig } from '@shared/types'

export class FalAiAdapter extends ProviderAdapter {
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

    const response = await fetch(`${this.config.baseUrl}/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    })

    if (!response.ok) {
      const text = await response.text()
      const { status, message } = normalizeError({ status: response.status, message: text })
      throw Object.assign(new Error(message), { status })
    }

    const json = await response.json() as { images?: Array<{ url: string }> }
    const imageUrl = json.images?.[0]?.url

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
