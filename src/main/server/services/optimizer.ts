import type { Message } from '@shared/types'
import { estimateTokens } from './compressor'
import { addTokensOptimized } from './metrics'

const MAX_CONTEXT_WINDOW = 128_000
const SYSTEM_PRIORITY = 3
const USER_PRIORITY = 2
const ASSISTANT_PRIORITY = 1

function countTokens(msgs: Message[]): number {
  let total = 0
  for (const m of msgs) {
    total += estimateTokens(m.content) + 4
    if (m.attachments) {
      for (const a of m.attachments) {
        total += Math.ceil(a.data.length / 4)
      }
    }
  }
  return total
}

function summarizeMessages(msgs: Message[], targetTokens: number): Message[] {
  const result = [...msgs]
  let total = countTokens(result)

  while (total > targetTokens && result.length > 2) {
    const removable = result.slice(1, -1)
    const sorted = removable
      .map((m, i) => ({ msg: m, idx: i + 1, prio: m.role === 'system' ? SYSTEM_PRIORITY : m.role === 'user' ? USER_PRIORITY : ASSISTANT_PRIORITY }))
      .sort((a, b) => a.prio - b.prio || a.idx - b.idx)

    const toRemove = sorted[0]
    if (!toRemove) break

    const t = estimateTokens(toRemove.msg.content) + 4
    result.splice(toRemove.idx, 1)
    total -= t
  }

  return result
}

export function optimizeMessages(
  messages: Message[],
  enabled: boolean,
  threshold: number
): { messages: Message[]; originalTokens: number; optimizedTokens: number } {
  const originalTokens = countTokens(messages)

  if (!enabled || messages.length <= 1) {
    return { messages, originalTokens, optimizedTokens: originalTokens }
  }

  const targetTokens = Math.round(MAX_CONTEXT_WINDOW * (threshold / 100))
  const optimized = summarizeMessages(messages, targetTokens)
  const optimizedTokens = countTokens(optimized)
  const saved = originalTokens - optimizedTokens
  addTokensOptimized(saved)

  return { messages: optimized, originalTokens, optimizedTokens }
}

export { estimateTokens }
