import type { Message } from '@shared/types'
import { estimateTokens } from './compressor'
import { addTokensOptimized } from './metrics'

// Leave headroom for the model's own output
const OUTPUT_HEADROOM = 4096
// Always keep at least this many recent turns intact
const MIN_RECENT_TURNS = 6
// When truncating a message instead of dropping it, keep at most this many chars
const TRUNCATE_TO_CHARS = 600

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

/**
 * Reduce the message list to fit within `targetTokens`.
 *
 * Strategy (in order of aggressiveness):
 * 1. Truncate middle assistant messages (losing verbosity, keeping gist).
 * 2. Drop middle assistant messages entirely.
 * 3. Truncate middle user messages.
 * 4. Drop middle user messages.
 *
 * System messages and the last MIN_RECENT_TURNS are never touched.
 */
function fitToWindow(messages: Message[], targetTokens: number): Message[] {
  const systemMsgs = messages.filter((m) => m.role === 'system')
  const nonSystem = messages.filter((m) => m.role !== 'system')

  if (nonSystem.length <= MIN_RECENT_TURNS) {
    return messages
  }

  // Split into "evictable" middle section and protected recent tail
  const middle = nonSystem.slice(0, nonSystem.length - MIN_RECENT_TURNS)
  const recent = nonSystem.slice(nonSystem.length - MIN_RECENT_TURNS)

  let result: Message[] = [...systemMsgs, ...middle, ...recent]
  let total = countTokens(result)

  if (total <= targetTokens) return result

  // Pass 1: truncate verbose middle assistant messages
  for (let i = 0; i < middle.length && total > targetTokens; i++) {
    const m = middle[i]
    if (m.role === 'assistant' && m.content.length > TRUNCATE_TO_CHARS) {
      const before = estimateTokens(m.content)
      middle[i] = { ...m, content: m.content.slice(0, TRUNCATE_TO_CHARS) + ' […]' }
      total -= before - estimateTokens(middle[i].content)
    }
  }

  result = [...systemMsgs, ...middle, ...recent]

  // Pass 2: drop middle assistant messages oldest-first
  for (let i = 0; i < middle.length && total > targetTokens; i++) {
    if (middle[i].role === 'assistant') {
      total -= estimateTokens(middle[i].content) + 4
      middle[i] = null as any
    }
  }

  const filteredMiddle1 = middle.filter(Boolean)
  result = [...systemMsgs, ...filteredMiddle1, ...recent]
  total = countTokens(result)

  // Pass 3: truncate middle user messages
  for (let i = 0; i < filteredMiddle1.length && total > targetTokens; i++) {
    const m = filteredMiddle1[i]
    if (m.role === 'user' && m.content.length > TRUNCATE_TO_CHARS) {
      const before = estimateTokens(m.content)
      filteredMiddle1[i] = { ...m, content: m.content.slice(0, TRUNCATE_TO_CHARS) + ' […]' }
      total -= before - estimateTokens(filteredMiddle1[i].content)
    }
  }

  // Pass 4: drop middle user messages oldest-first (last resort)
  for (let i = 0; i < filteredMiddle1.length && total > targetTokens; i++) {
    if (filteredMiddle1[i].role === 'user') {
      total -= estimateTokens(filteredMiddle1[i].content) + 4
      filteredMiddle1[i] = null as any
    }
  }

  return [...systemMsgs, ...filteredMiddle1.filter(Boolean), ...recent]
}

export function optimizeMessages(
  messages: Message[],
  enabled: boolean,
  threshold: number,
  /** Actual context window of the chosen model, in tokens. Defaults to 128k. */
  modelContextWindow = 128_000
): { messages: Message[]; originalTokens: number; optimizedTokens: number } {
  const originalTokens = countTokens(messages)

  if (!enabled || messages.length <= 1) {
    return { messages, originalTokens, optimizedTokens: originalTokens }
  }

  const effectiveWindow = Math.min(modelContextWindow, 1_000_000)
  const targetTokens = Math.round(effectiveWindow * (threshold / 100)) - OUTPUT_HEADROOM

  if (originalTokens <= targetTokens) {
    return { messages, originalTokens, optimizedTokens: originalTokens }
  }

  const optimized = fitToWindow(messages, targetTokens)
  const optimizedTokens = countTokens(optimized)
  const saved = originalTokens - optimizedTokens
  if (saved > 0) addTokensOptimized(saved)

  return { messages: optimized, originalTokens, optimizedTokens }
}

export { estimateTokens }
