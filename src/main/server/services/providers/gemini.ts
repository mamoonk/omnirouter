import { GoogleGenerativeAI } from '@google/generative-ai'
import { ProviderAdapter, normalizeError } from './adapter'
import type { CompletionRequest, CompletionResponse, ProviderConfig } from '@shared/types'

export class GeminiAdapter extends ProviderAdapter {
  readonly config: ProviderConfig
  private client: GoogleGenerativeAI

  constructor(config: ProviderConfig) {
    super()
    this.config = config
    this.client = new GoogleGenerativeAI(this.getApiKey())
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const modelId = req.model || this.config.models[0].id

    if (modelId.startsWith('imagen-')) {
      return this.generateImage(req, modelId)
    }

    return this.generateText(req, modelId)
  }

  private toParts(msg: typeof this.config.models[0]): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
    if (msg.content) parts.push({ text: msg.content })
    if ((msg as any).attachments) {
      for (const a of (msg as any).attachments as Array<{ mime: string; data: string; type: string }>) {
        if (a.type === 'image' || a.type === 'video') {
          parts.push({ inlineData: { mimeType: a.mime, data: a.data } })
        }
      }
    }
    return parts
  }

  private async generateText(req: CompletionRequest, modelId: string): Promise<CompletionResponse> {
    const start = Date.now()

    try {
      const genModel = this.client.getGenerativeModel({ model: modelId })
      const history = req.messages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: this.toParts(m as any)
      }))
      const lastMsg = req.messages[req.messages.length - 1]

      const chat = genModel.startChat({ history })
      const result = await chat.sendMessage(this.toParts(lastMsg as any))
      const response = result.response

      return {
        content: response.text(),
        model: modelId,
        provider: this.config.name,
        tokensIn: response.usageMetadata?.promptTokenCount || 0,
        tokensOut: response.usageMetadata?.candidatesTokenCount || 0,
        finishReason: 'stop',
        latencyMs: Date.now() - start
      }
    } catch (err) {
      const { status, message } = normalizeError(err)
      throw Object.assign(new Error(message), { status })
    }
  }

  private async generateImage(req: CompletionRequest, modelId: string): Promise<CompletionResponse> {
    const start = Date.now()
    const prompt = req.messages.map((m) => m.content).join('\n')
    const key = this.getApiKey()

    const response = await fetch(
      `${this.config.baseUrl}/models/${modelId}:predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1 }
        })
      }
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Imagen error ${response.status}: ${text}`)
    }

    const json = await response.json()
    const prediction = json.predictions?.[0]

    return {
      content: `Generated image: ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}`,
      model: modelId,
      provider: this.config.name,
      tokensIn: prompt.length,
      tokensOut: 0,
      finishReason: 'stop',
      latencyMs: Date.now() - start,
      imageData: prediction?.bytesBase64Encoded || prediction?.bytesBase64 || undefined
    }
  }
}
