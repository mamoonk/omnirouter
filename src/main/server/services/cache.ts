import { createHash } from 'crypto'
import { getCacheEntry, setCacheEntry } from '../db/index'
import type { CompletionResponse } from '@shared/types'

export function hashPrompt(messages: Array<{ role: string; content: string }>): string {
  const normalized = messages
    .map((m) => `${m.role}:${m.content.trim().replace(/\s+/g, ' ')}`)
    .join('|')
  return createHash('sha256').update(normalized).digest('hex')
}

export function checkCache(promptHash: string): CompletionResponse | null {
  const entry = getCacheEntry(promptHash)
  if (!entry) return null

  return {
    content: entry.response,
    provider: entry.provider,
    model: entry.model,
    tokensIn: entry.tokensIn,
    tokensOut: entry.tokensOut,
    finishReason: 'stop',
    latencyMs: 0
  }
}

export function writeCache(
  promptHash: string,
  prompt: string,
  response: CompletionResponse
): void {
  setCacheEntry(
    promptHash,
    prompt,
    response.content,
    response.provider,
    response.model,
    response.tokensIn,
    response.tokensOut
  )
}
