import { ProviderAdapter, normalizeError } from './adapter'
import type { CompletionRequest, CompletionResponse, ProviderConfig } from '@shared/types'

export class StabilityAdapter extends ProviderAdapter {
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

    const response = await fetch(`${this.config.baseUrl}/generation/${model}/text-to-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ text_prompts: [{ text: prompt }], samples: 1 })
    })

    if (!response.ok) {
      const text = await response.text()
      const { status, message } = normalizeError({ status: response.status, message: text })
      throw Object.assign(new Error(message), { status })
    }

    const json = await response.json() as { artifacts?: Array<{ base64: string }> }
    const image = json.artifacts?.[0]

    return {
      content: `Generated image: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`,
      model,
      provider: this.config.name,
      tokensIn: prompt.length,
      tokensOut: 0,
      finishReason: 'stop',
      latencyMs: Date.now() - start,
      imageData: image?.base64
    }
  }
}
