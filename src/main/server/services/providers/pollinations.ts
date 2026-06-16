import { ProviderAdapter, normalizeError } from './adapter'
import type { CompletionRequest, CompletionResponse, ProviderConfig } from '@shared/types'

/**
 * Pollinations.ai needs no API key at all — both endpoints are plain unauthenticated
 * GET requests with the prompt URL-encoded into the path. Image requests don't even
 * need a round trip server-side: the URL itself is a valid <img src>.
 */
export class PollinationsAdapter extends ProviderAdapter {
  readonly config: ProviderConfig

  constructor(config: ProviderConfig, _apiKey?: string) {
    super(undefined)
    this.config = config
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const model = req.model || this.config.models[0].id
    const modelDef = this.config.models.find((m) => m.id === model)
    const prompt = req.messages.map((m) => m.content).join('\n')

    if (modelDef?.capabilities?.includes('image')) {
      return this.generateImage(prompt, model)
    }
    return this.generateText(req, prompt, model)
  }

  private generateImage(prompt: string, model: string): CompletionResponse {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`

    return {
      content: `Generated image: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`,
      model,
      provider: this.config.name,
      tokensIn: prompt.length,
      tokensOut: 0,
      finishReason: 'stop',
      latencyMs: 0,
      imageUrl
    }
  }

  private async generateText(req: CompletionRequest, prompt: string, model: string): Promise<CompletionResponse> {
    const start = Date.now()

    try {
      const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`)

      if (!response.ok) {
        const text = await response.text()
        const { status, message } = normalizeError({ status: response.status, message: text })
        throw Object.assign(new Error(message), { status })
      }

      const content = await response.text()

      return {
        content,
        model,
        provider: this.config.name,
        tokensIn: this.estimateTokens(prompt),
        tokensOut: this.estimateTokens(content),
        finishReason: 'stop',
        latencyMs: Date.now() - start
      }
    } catch (err) {
      const { status, message } = normalizeError(err)
      throw Object.assign(new Error(message), { status })
    }
  }
}
