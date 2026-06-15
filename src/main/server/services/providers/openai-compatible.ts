import OpenAI from 'openai'
import { ProviderAdapter } from './adapter'
import type { Attachment, CompletionRequest, CompletionResponse, ProviderConfig } from '@shared/types'
import { normalizeError } from './adapter'

type OpenAIContent = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>

export class OpenAICompatibleAdapter extends ProviderAdapter {
  readonly config: ProviderConfig
  private client: OpenAI

  constructor(config: ProviderConfig) {
    super()
    this.config = config
    this.client = new OpenAI({
      apiKey: this.getApiKey(),
      baseURL: config.baseUrl
    })
  }

  private toContent(msg: { content: string; attachments?: Attachment[] }): OpenAIContent {
    const atts = msg.attachments
    if (!atts || atts.length === 0) return msg.content

    const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = []
    if (msg.content) parts.push({ type: 'text', text: msg.content })
    for (const a of atts) {
      if (a.type === 'image') {
        parts.push({ type: 'image_url', image_url: { url: `data:${a.mime};base64,${a.data}` } })
      }
    }
    return parts
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now()
    const model = req.model || this.config.models[0].id

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: req.messages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: this.toContent(m as any)
        })),
        max_tokens: req.maxTokens || 4096
      })

      const choice = response.choices[0]

      return {
        content: choice?.message?.content || '',
        model,
        provider: this.config.name,
        tokensIn: response.usage?.prompt_tokens || 0,
        tokensOut: response.usage?.completion_tokens || 0,
        finishReason: choice?.finish_reason === 'stop' ? 'stop' : choice?.finish_reason === 'length' ? 'length' : 'error',
        latencyMs: Date.now() - start
      }
    } catch (err) {
      const { status, message } = normalizeError(err)
      throw Object.assign(new Error(message), { status })
    }
  }
}
