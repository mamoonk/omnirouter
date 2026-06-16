import type { IntentCategory } from '@shared/types'

const FACTUAL_PATTERNS = [
  /^what\s+(is|are|does|was|were)/i,
  /^(explain|define|describe|summarize|tell)\s/i,
  /^how\s+(does|do|is|are|can|would|should)/i,
  /^why\s+(does|do|is|are|did|would)/i,
  /^(who|where|when)\s/i,
  /^(list|name|compare|contrast|difference)/i
]

const CODE_PATTERNS = [
  /write\s+(a|an|the)\s+(function|class|program|script|code|api|endpoint)/i,
  /\b(code|function|bug|debug|refactor|implement|compile|syntax|error)\b/i,
  /^\`\`\`/,
  /how\s+do\s+I\s+(write|implement|create|build|fix)/i,
  /(python|javascript|typescript|rust|golang|java|c\+\+|ruby|php|bash|sql)\s/i,
  /(react|node|express|django|flask|fastapi|spring|rails)/i
]

const IMAGE_PATTERNS = [
  /(generate|create|draw|paint|render|make|produce|design)\s+(a|an|the)\s+(image|picture|photo|illustration|art|drawing|meme|logo|icon|graphic|slide|diagram|chart|infographic|banner|flyer|poster|meme)/i,
  /(generate|create|draw|make|design)\s+.*(image|picture|photo|illustration|slide|diagram|chart|infographic|banner|poster)/i,
  /\b(dalle|dall-e|midjourney|stable diffusion|flux|imagen)\b/i,
  /^draw\s+/i,
  /^create\s+(a|an)\s+(image|picture|photo|illustration|slide|diagram|chart)/i
]

const LONG_DOC_THRESHOLD = 4000

export function classifyIntent(messages: Array<{ role: string; content: string }>): IntentCategory {
  const lastMsg = messages[messages.length - 1]
  const content = lastMsg?.content || ''
  const fullText = messages.map((m) => m.content).join(' ')

  if (fullText.length > LONG_DOC_THRESHOLD) {
    return 'long_doc'
  }

  for (const pattern of IMAGE_PATTERNS) {
    if (pattern.test(content)) {
      return 'image'
    }
  }

  for (const pattern of CODE_PATTERNS) {
    if (pattern.test(content)) {
      return 'code'
    }
  }

  for (const pattern of FACTUAL_PATTERNS) {
    if (pattern.test(content)) {
      return 'factual'
    }
  }

  return 'creative'
}

export function getIntentScores(intent: IntentCategory): Record<string, number> {
  switch (intent) {
    case 'factual':
      return {
        gemini: 1.0, groq: 0.9, cerebras: 0.8,
        deepseek: 0.7, openai: 0.5, anthropic: 0.5,
        mistral: 0.6, cohere: 0.6, together: 0.7,
        fireworks: 0.7, openrouter: 0.7, nvidia: 0.6,
        perplexity: 0.8, xai: 0.5, eden: 0.5,
        siliconflow: 0.5, huggingface: 0.6, cloudflare: 0.5,
        dashscope: 0.6, ai21: 0.5
      }
    case 'code':
      // Scores reflect coding ability + tool_use support (needed for agentic coding tasks).
      // Top tier: strong coding + reliable function calling.
      return {
        openai: 1.0, anthropic: 1.0, deepseek: 0.95,
        nvidia: 0.9, mistral: 0.85, openrouter: 0.85,
        gemini: 0.8, groq: 0.75, xai: 0.75,
        dashscope: 0.75, together: 0.7, fireworks: 0.7,
        cerebras: 0.65, eden: 0.65, cohere: 0.6,
        siliconflow: 0.55, huggingface: 0.5,
        cloudflare: 0.45, perplexity: 0.2, ai21: 0.5
      }
    case 'long_doc':
      return {
        gemini: 1.0, dashscope: 0.9, anthropic: 0.8,
        openai: 0.7, cohere: 0.7, deepseek: 0.6,
        groq: 0.3, cerebras: 0.4, mistral: 0.4,
        together: 0.4, fireworks: 0.4, openrouter: 0.5,
        nvidia: 0.6, perplexity: 0.5, xai: 0.4,
        eden: 0.3, siliconflow: 0.3, huggingface: 0.3,
        cloudflare: 0.3, ai21: 0.5
      }
    case 'creative':
      return {
        gemini: 0.8, groq: 0.7, anthropic: 0.9,
        openai: 0.9, mistral: 0.8, cohere: 0.7,
        deepseek: 0.6, together: 0.8, fireworks: 0.7,
        openrouter: 0.7, nvidia: 0.5, perplexity: 0.6,
        xai: 0.7, eden: 0.5, siliconflow: 0.4,
        huggingface: 0.5, cloudflare: 0.4, dashscope: 0.7,
        ai21: 0.7, cerebras: 0.5
      }
    case 'image':
      return {
        openai: 1.0, together: 0.9, huggingface: 0.7,
        siliconflow: 0.6, eden: 0.5, nvidia: 0.5,
        fireworks: 0.4, openrouter: 0.3, dashscope: 0.3,
        gemini: 0.1, groq: 0.1, deepseek: 0.1,
        anthropic: 0.1, mistral: 0.1, cohere: 0.1,
        cerebras: 0.1, perplexity: 0.1, xai: 0.1,
        cloudflare: 0.1, ai21: 0.1
      }
  }
}
