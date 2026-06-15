import type { Message } from '@shared/types'
import { addTokensOptimized } from './metrics'

const SYSTEM_PROMPT_BOILERPLATE = [
  /you\s+are\s+(an?\s+)?(ai|helpful|expert|intelligent|knowledgeable)\s+(assistant|helper|chatbot)/gi,
  /you\s+are\s+(a\s+)?(large\s+)?language\s+model/gi,
  /you\s+were\s+(trained|created|developed)\s+by/gi,
  /as\s+(an?\s+)?(ai|language\s+model)/gi,
  /i\s+am\s+(an?\s+)?(ai|large\s+language\s+model|assistant)/gi,
  /i'm\s+(an?\s+)?(ai|assistant)/gi,
  /my\s+(purpose|goal|role)\s+is\s+to/gi
]

export function compressMessages(messages: Message[], enabled: boolean): Message[] {
  if (!enabled) return messages

  let saved = 0

  const result = messages.map((msg) => {
    if (msg.role !== 'system' && msg.role !== 'user') return msg

    const before = estimateTokens(msg.content)
    let content = msg.content

    content = content.replace(/\s+/g, ' ').trim()

    if (msg.role === 'system') {
      for (const pattern of SYSTEM_PROMPT_BOILERPLATE) {
        content = content.replace(pattern, '').trim()
      }
    }

    saved += before - estimateTokens(content)
    return { ...msg, content }
  })

  addTokensOptimized(saved)
  return result
}

export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4)
}
