import type { CompletionResponse, Message, RouterScore, ProviderConfig, RoutingStrategy, ActivityStep, QuotaStatus } from '@shared/types'
import type { IntentCategory } from '@shared/types'
import { classifyIntent, getIntentScores } from './classifier'
import { getQuotaStatus, markDegraded, recordUsage, getBestAvailableModel } from './quota'
import { hashPrompt, checkCache, writeCache } from './cache'
import { compressMessages } from './compressor'
import { optimizeMessages } from './optimizer'
import { createAdapter } from './providers/factory'
import { getEnabledProviders, getChatProviders, getImageCapableProviders } from './providers/registry'
import { resolveApiKey, hasApiKey } from './apiKeys'

export interface RouterOptions {
  userId: string
  cacheEnabled: boolean
  compressionEnabled: boolean
  tokenOptimization?: boolean
  tokenOptimizationThreshold?: number
  preferCode?: boolean
  routingStrategy?: RoutingStrategy
  /** Optional sink for live "thinking"/tool-usage steps surfaced to the UI. */
  onStep?: (step: ActivityStep) => void
}

/**
 * Builds short-lived step emitters. `start()` emits a `running` step and returns
 * handles that re-emit the same id as `done`/`fail`; `log()` emits a one-shot step.
 */
function makeStepper(onStep?: (step: ActivityStep) => void) {
  let n = 0
  const emit = (s: ActivityStep) => onStep?.(s)
  return {
    start(kind: ActivityStep['kind'], label: string, detail?: string) {
      const id = `r${++n}`
      emit({ id, kind, label, detail, status: 'running' })
      return {
        done: (d?: string) => emit({ id, kind, label, detail: d ?? detail, status: 'done' }),
        fail: (d?: string) => emit({ id, kind, label, detail: d ?? detail, status: 'fail' })
      }
    },
    log(kind: ActivityStep['kind'], label: string, detail?: string, status: 'done' | 'fail' = 'done') {
      emit({ id: `r${++n}`, kind, label, detail, status })
    }
  }
}

export interface RouterResult {
  response: CompletionResponse
  fromCache: boolean
  provider: string
  model: string
}

export async function routeRequest(
  messages: Message[],
  options: RouterOptions
): Promise<RouterResult> {
  const step = makeStepper(options.onStep)
  const promptHash = hashPrompt(messages)

  if (options.cacheEnabled) {
    const s = step.start('cache', 'Checking response cache')
    const cached = checkCache(promptHash)
    if (cached) {
      s.done(`Cache hit — reusing ${cached.provider} response`)
      return {
        response: cached,
        fromCache: true,
        provider: cached.provider,
        model: cached.model
      }
    }
    s.done('No cached match — generating a fresh response')
  }

  const classifyStep = step.start('think', 'Analyzing the request')
  const rawIntent = classifyIntent(messages)
  const intent: IntentCategory = (options.preferCode && rawIntent !== 'image') ? 'code' : rawIntent
  classifyStep.done(
    options.preferCode && rawIntent !== 'image'
      ? `Agent mode — treating as a "code" task`
      : `Detected "${intent}" intent`
  )

  if (intent === 'image') {
    return handleImageRequest(messages, promptHash, options, step)
  }

  const providers = getChatProviders()
  const availableProviders = providers.filter((p) => hasApiKey(options.userId, p))

  if (availableProviders.length === 0) {
    step.log('error', 'No providers available', 'No API keys are configured', 'fail')
    return {
      fromCache: false,
      provider: 'system',
      model: '',
      response: {
        content: 'No API keys configured. Go to Settings to add your provider API keys, then try again.',
        model: '',
        provider: 'system',
        tokensIn: 0,
        tokensOut: 0,
        finishReason: 'error',
        latencyMs: 0
      }
    }
  }

  const compressed = compressMessages(messages, options.compressionEnabled)

  // Determine context window from the top-scoring available provider so the
  // optimizer can set an accurate token budget before we make any API call.
  const previewScores = await scoreProviders(options.userId, availableProviders, intent, options.routingStrategy)
  previewScores.sort((a, b) => b.score - a.score)
  const topProvider = availableProviders.find((p) => p.name === previewScores[0]?.provider)
  const topModel = topProvider ? getBestAvailableModel(topProvider, intent) : undefined
  const modelContextWindow = topProvider?.models.find((m) => m.id === topModel)?.contextWindow ?? 128_000

  const optimized = optimizeMessages(
    compressed,
    options.tokenOptimization ?? false,
    options.tokenOptimizationThreshold ?? 70,
    modelContextWindow
  )
  const finalMessages = optimized.messages
  if (options.compressionEnabled || options.tokenOptimization) {
    const saved = optimized.originalTokens - optimized.optimizedTokens
    const detail = saved > 0
      ? `${finalMessages.length} message(s) · saved ~${saved} tokens (window: ${modelContextWindow.toLocaleString()})`
      : `${finalMessages.length} message(s) · no reduction needed`
    step.log('tool', 'Optimizing context', detail)
  }

  const strategyLabel = options.routingStrategy && options.routingStrategy !== 'smart'
    ? `${options.routingStrategy} strategy`
    : 'smart routing'
  const rankStep = step.start('route', 'Ranking providers', `Scoring ${availableProviders.length} provider(s) with ${strategyLabel}`)
  // Reuse the scores already computed for the context-window preview above
  const scores = previewScores
  const top = scores.slice(0, 3).map((s) => `${s.provider} (${s.score.toFixed(2)})`).join(', ')
  rankStep.done(`Top pick: ${top}`)

  if (options.routingStrategy === 'roundrobin') {
    roundRobinIndex = (roundRobinIndex + 1) % availableProviders.length
  }

  const errors: string[] = []

  for (const score of scores) {
    const config = availableProviders.find((p) => p.name === score.provider)
    if (!config) continue

    const model = getBestAvailableModel(config, intent)
    const callStep = step.start('provider', `Calling ${config.displayName}`, model)

    try {
      const apiKey = resolveApiKey(options.userId, config.apiKeyEnv)
      const adapter = createAdapter(config, apiKey)

      const response = await adapter.complete({
        model,
        messages: finalMessages,
        maxTokens: 4096
      })

      recordUsage(options.userId, config.name, response.tokensIn, response.tokensOut)
      callStep.done(`${config.displayName} answered · ${response.tokensIn}+${response.tokensOut} tokens · ${response.latencyMs}ms`)

      if (options.cacheEnabled) {
        writeCache(promptHash, JSON.stringify(messages), response)
      }

      return {
        response,
        fromCache: false,
        provider: config.name,
        model
      }
    } catch (err: any) {
      const reason = err.status === 429 ? 'rate-limited' : (err.message || 'error')
      errors.push(`${score.provider}: ${reason}`)
      callStep.fail(`${config.displayName} failed (${reason}) — failing over`)
      if (err.status === 429) {
        markDegraded(options.userId, score.provider, 'Rate limited')
      } else {
        markDegraded(options.userId, score.provider, err.message || 'Error', 60_000)
      }
    }
  }

  return {
    fromCache: false,
    provider: 'system',
    model: '',
    response: {
      content: `All providers failed:\n${errors.join('\n')}\n\nCheck your API keys in Settings and ensure they have available quota.`,
      model: '',
      provider: 'system',
      tokensIn: 0,
      tokensOut: 0,
      finishReason: 'error',
      latencyMs: 0
    }
  }
}

async function handleImageRequest(
  messages: Message[],
  _promptHash: string,
  _options: RouterOptions,
  step: ReturnType<typeof makeStepper>
): Promise<RouterResult> {
  step.log('route', 'Routing to image generation', 'Request looks like an image prompt')
  const providers = getImageCapableProviders()
  const availableProviders = providers.filter((p) => hasApiKey(_options.userId, p))

  if (availableProviders.length === 0) {
    step.log('error', 'No image providers', 'Add a Gemini API key (Imagen) in Settings', 'fail')
    return {
      fromCache: false,
      provider: 'system',
      model: '',
      response: {
        content: 'No image-capable providers available. Add a Gemini API key in Settings (Imagen model).',
        model: '',
        provider: 'system',
        tokensIn: 0,
        tokensOut: 0,
        finishReason: 'error',
        latencyMs: 0
      }
    }
  }

  const errors: string[] = []

  for (const config of availableProviders) {
    const imageModel = config.models.find((m) => m.capabilities?.includes('image'))
    const model = imageModel?.id || config.models[0]?.id || ''
    const imgStep = step.start('provider', `Generating image with ${config.displayName}`, model)
    try {
      const apiKey = resolveApiKey(_options.userId, config.apiKeyEnv)
      const adapter = createAdapter(config, apiKey)

      const response = await adapter.complete({
        model,
        messages
      })

      if (!response.imageData && !response.imageUrl) {
        throw new Error('Provider responded without image data')
      }

      imgStep.done(`${config.displayName} returned an image`)
      return {
        response,
        fromCache: false,
        provider: config.name,
        model
      }
    } catch (err: any) {
      imgStep.fail(`${config.displayName} failed (${err.message || 'error'})`)
      errors.push(`${config.name}: ${err.message || 'error'}`)
    }
  }

  return {
    fromCache: false,
    provider: 'system',
    model: '',
    response: {
      content: `All image providers failed:\n${errors.join('\n')}`,
      model: '',
      provider: 'system',
      tokensIn: 0,
      tokensOut: 0,
      finishReason: 'error',
      latencyMs: 0
    }
  }
}

let roundRobinIndex = 0

const FASTEST_PROVIDERS = ['gemini', 'groq', 'cerebras', 'deepseek', 'together', 'openai']

/**
 * Combines the daily-token and daily-request budgets into one weight — some providers
 * (e.g. Gemini's free tier) cap requests/day rather than tokens/day, so whichever
 * budget is closer to exhausted should dominate the score.
 */
function dailyWeightFor(qs: QuotaStatus): number {
  const tokenWeight = qs.dailyTokenLimit > 0 ? qs.dailyTokensRemaining / qs.dailyTokenLimit : 1
  if (qs.dailyRequestLimit === undefined || qs.dailyRequestsRemaining === undefined) return tokenWeight
  const requestWeight = qs.dailyRequestLimit > 0 ? qs.dailyRequestsRemaining / qs.dailyRequestLimit : 1
  return Math.min(tokenWeight, requestWeight)
}

async function scoreProviders(
  userId: string,
  providers: ProviderConfig[],
  intent: IntentCategory,
  strategy?: RoutingStrategy
): Promise<RouterScore[]> {
  const intentScores = getIntentScores(intent)
  const quotaStatuses = getQuotaStatus(userId, providers)

  return providers.map((config, i) => {
    const qs = quotaStatuses.find((q) => q.provider === config.name)!
    let score: number
    const factors = { intentWeight: 0, rpmWeight: 0, dailyWeight: 0, failurePenalty: 0 }

    switch (strategy) {
      case 'cheapest': {
        const tierScore = config.tier === 1 ? 1.0 : config.tier === 2 ? 0.5 : 0.1
        const rpmWeight = qs.rpmLimit > 0 ? qs.rpmRemaining / qs.rpmLimit : 0
        const dailyWeight = dailyWeightFor(qs)
        const failurePenalty = qs.degraded ? 0 : 1
        score = tierScore * 0.5 + rpmWeight * 0.2 + dailyWeight * 0.2 + failurePenalty * 0.1
        factors.intentWeight = tierScore
        factors.rpmWeight = rpmWeight
        factors.dailyWeight = dailyWeight
        factors.failurePenalty = failurePenalty
        break
      }
      case 'fastest': {
        const speedScore = FASTEST_PROVIDERS.indexOf(config.name) >= 0 ? 1.0 : 0.3
        const rpmWeight = qs.rpmLimit > 0 ? qs.rpmRemaining / qs.rpmLimit : 0
        const dailyWeight = dailyWeightFor(qs)
        const failurePenalty = qs.degraded ? 0 : 1
        score = speedScore * 0.5 + rpmWeight * 0.2 + dailyWeight * 0.2 + failurePenalty * 0.1
        factors.intentWeight = speedScore
        factors.rpmWeight = rpmWeight
        factors.dailyWeight = dailyWeight
        factors.failurePenalty = failurePenalty
        break
      }
      case 'roundrobin': {
        const rpmWeight = qs.rpmLimit > 0 ? qs.rpmRemaining / qs.rpmLimit : 0
        const dailyWeight = dailyWeightFor(qs)
        const failurePenalty = qs.degraded ? 0 : 1
        const rr = ((i + roundRobinIndex) % providers.length) === 0 ? 1 : 0
        score = rr * 0.6 + rpmWeight * 0.15 + dailyWeight * 0.15 + failurePenalty * 0.1
        factors.intentWeight = rr
        factors.rpmWeight = rpmWeight
        factors.dailyWeight = dailyWeight
        factors.failurePenalty = failurePenalty
        break
      }
      default: {
        const intentWeight = intentScores[config.name] || 0.3
        const rpmWeight = qs.rpmLimit > 0 ? qs.rpmRemaining / qs.rpmLimit : 0
        const dailyWeight = dailyWeightFor(qs)
        const failurePenalty = qs.degraded ? 0 : 1
        score = intentWeight * 0.4 + rpmWeight * 0.25 + dailyWeight * 0.25 + failurePenalty * 0.1
        factors.intentWeight = intentWeight
        factors.rpmWeight = rpmWeight
        factors.dailyWeight = dailyWeight
        factors.failurePenalty = failurePenalty
        break
      }
    }

    return {
      provider: config.name,
      model: config.models[0].id,
      score,
      factors
    }
  })
}
