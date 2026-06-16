import type { Message } from '@shared/types'
import { addTokensOptimized } from './metrics'

const SYSTEM_BOILERPLATE = [
  /you\s+are\s+(an?\s+)?(ai|helpful|expert|intelligent|knowledgeable)\s+(assistant|helper|chatbot)/gi,
  /you\s+are\s+(a\s+)?(large\s+)?language\s+model/gi,
  /you\s+were\s+(trained|created|developed)\s+by/gi,
  /as\s+(an?\s+)?(ai|language\s+model)/gi,
  /i\s+am\s+(an?\s+)?(ai|large\s+language\s+model|assistant)/gi,
  /i'm\s+(an?\s+)?(ai|assistant)/gi,
  /my\s+(purpose|goal|role)\s+is\s+to/gi,
  /please\s+(note|remember|keep\s+in\s+mind)\s+that/gi,
  /feel\s+free\s+to\s+ask/gi,
  /i('m|\s+am)\s+here\s+to\s+help/gi,
  /how\s+can\s+I\s+assist\s+you\s+(today|further)?/gi
]

// Long assistant turns older than this many positions from the end get truncated
const TRUNCATE_AFTER_CHARS = 1200
const KEEP_RECENT_TURNS = 4

export function compressMessages(messages: Message[], enabled: boolean): Message[] {
  if (!enabled) return messages

  let saved = 0
  const total = messages.length

  const result = messages.map((msg, idx) => {
    const before = estimateTokens(msg.content)
    let content = msg.content

    // Collapse whitespace everywhere
    content = content.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

    // Strip boilerplate from system messages
    if (msg.role === 'system') {
      for (const pattern of SYSTEM_BOILERPLATE) {
        content = content.replace(pattern, '').trim()
      }
      content = content.replace(/\s{2,}/g, ' ').trim()
    }

    // Truncate old verbose assistant messages — keep only recent turns verbatim
    if (msg.role === 'assistant' && idx < total - KEEP_RECENT_TURNS && content.length > TRUNCATE_AFTER_CHARS) {
      content = content.slice(0, TRUNCATE_AFTER_CHARS) + ' […]'
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
