import { createAdapter } from './providers/factory'
import { getChatProviders, getProviderConfig } from './providers/registry'
import { classifyIntent, getIntentScores } from './classifier'
import { markDegraded, recordUsage } from './quota'
import { getSetting } from '../db/index'
import type { Message, DebateData, DebateRound, ActivityStep } from '@shared/types'
import type { ProviderConfig } from '@shared/types'

const CRITIC_PROMPT = `You are a critical reviewer. Analyze the following response and identify:
1. Any factual errors or inaccuracies
2. Missing information or gaps
3. Logical flaws
4. Suggestions for improvement

Be constructive and specific. Keep your feedback concise (2-4 paragraphs).`

const REFINER_PROMPT = `You are improving your previous answer based on reviewer feedback.
Provide a refined, corrected version of your answer that addresses all the feedback.
Make it clear, accurate, and comprehensive. Include the full improved answer.`

function getConfiguredProvider(name?: string): ProviderConfig | null {
  if (!name) return null
  const cfg = getProviderConfig(name)
  if (cfg && process.env[cfg.apiKeyEnv]) return cfg
  return null
}

async function pickProviders(userMessages: Message[]): Promise<{ primary: ProviderConfig; critic: ProviderConfig }> {
  const primaryName = getSetting('debatePrimaryProvider')
  const criticName = getSetting('debateCriticProvider')

  const explicitPrimary = getConfiguredProvider(primaryName || undefined)
  const explicitCritic = getConfiguredProvider(criticName || undefined)

  if (explicitPrimary && explicitCritic) {
    return { primary: explicitPrimary, critic: explicitCritic }
  }

  const intent = classifyIntent(userMessages)
  const intentScores = getIntentScores(intent)
  const providers = getChatProviders().filter((p) => process.env[p.apiKeyEnv])

  const scored = providers
    .map((p) => ({ provider: p, score: intentScores[p.name] || 0.3 }))
    .sort((a, b) => b.score - a.score)

  const primary = explicitPrimary || scored[0]?.provider
  const critic = explicitCritic || (scored.find((s) => s.provider.name !== primary?.name)?.provider)

  if (!primary) throw new Error('No providers available with API keys')
  if (!critic) throw new Error('Need at least 2 providers with API keys for debate mode')

  return { primary, critic }
}

export async function runDebate(
  userMessages: Message[],
  rounds: number,
  onStep?: (step: ActivityStep) => void
): Promise<DebateData> {
  let stepN = 0
  const emitStep = (label: string, detail: string, status: ActivityStep['status'] = 'done') =>
    onStep?.({ id: `d${++stepN}`, kind: 'debate', label, detail, status })

  emitStep('Selecting debate participants', 'Choosing a primary author and a critic')
  const { primary, critic } = await pickProviders(userMessages)
  emitStep('Debate participants chosen', `${primary.displayName} answers · ${critic.displayName} reviews`)
  const primaryAdapter = createAdapter(primary)
  const criticAdapter = createAdapter(critic)

  const primaryModel = primary.models[0]?.id || ''
  const criticModel = critic.models[0]?.id || ''
  const debateRounds: DebateRound[] = []

  const lastContent = userMessages[userMessages.length - 1]?.content || ''
  let currentAnswer = ''

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function callWithRetry(
  adapter: any,
  model: string,
  messages: Message[],
  providerName: string,
  maxTokens: number,
  attempt = 1
): Promise<string> {
  try {
    const res = await adapter.complete({ model, messages, maxTokens })
    recordUsage(providerName, res.tokensIn || 0, res.tokensOut || 0)
    return res.content
  } catch (err: any) {
    markDegraded(providerName, err.message || 'Error', 30_000)
    if (err.status === 429 && attempt < 3) {
      const wait = attempt * 2000
      await delay(wait)
      return callWithRetry(adapter, model, messages, providerName, maxTokens, attempt + 1)
    }
    throw err
  }
}

  for (let r = 0; r < rounds; r++) {
    emitStep(
      r === 0 ? `${primary.displayName} drafting an answer` : `${primary.displayName} refining (round ${r + 1})`,
      r === 0 ? 'Generating the initial response' : 'Applying reviewer feedback',
      'running'
    )
    // Step 1: Primary generates answer (or refines)
    const primaryInput: Message[] = r === 0
      ? userMessages
      : [
          { role: 'system', content: REFINER_PROMPT },
          ...userMessages,
          { role: 'assistant', content: currentAnswer },
          { role: 'user', content: `Reviewer feedback:\n${debateRounds[debateRounds.length - 1]?.content || ''}\n\nPlease provide your refined answer.` }
        ]

    try {
      currentAnswer = await callWithRetry(primaryAdapter, primaryModel, primaryInput, primary.name, 4096)
    } catch (err: any) {
      currentAnswer = currentAnswer || `[${primary.displayName} error: ${err.message}]`
    }

    debateRounds.push({
      role: r === 0 ? 'primary' : 'refiner',
      provider: primary.name,
      model: primaryModel,
      content: currentAnswer,
      label: r === 0 ? `${primary.displayName} (initial answer)` : `${primary.displayName} (refined)`
    })

    emitStep(`${primary.displayName} answered`, `Round ${r + 1} draft ready`)

    await delay(500)

    // Step 2: Critic reviews
    emitStep(`${critic.displayName} reviewing`, 'Critiquing the draft for errors and gaps', 'running')
    const criticInput: Message[] = [
      { role: 'system', content: CRITIC_PROMPT },
      ...userMessages,
      { role: 'assistant', content: currentAnswer },
      { role: 'user', content: `Review the above response to the user's question. Provide constructive feedback.` }
    ]

    try {
      const criticResult = await callWithRetry(criticAdapter, criticModel, criticInput, critic.name, 2048)
      debateRounds.push({
        role: 'critic',
        provider: critic.name,
        model: criticModel,
        content: criticResult,
        label: `${critic.displayName} (review)`
      })
      emitStep(`${critic.displayName} review complete`, 'Feedback ready for refinement')
    } catch (err: any) {
      emitStep(`${critic.displayName} review failed`, err.message || 'Error', 'fail')
      debateRounds.push({
        role: 'critic',
        provider: critic.name,
        model: criticModel,
        content: `[Critic error: ${err.message}]`,
        label: `${critic.displayName} (review failed)`
      })
    }
  }

  await delay(500)

  // Final refinement
  emitStep(`${primary.displayName} composing final answer`, 'Incorporating all reviewer feedback', 'running')
  const finalInput: Message[] = [
    { role: 'system', content: REFINER_PROMPT },
    ...userMessages,
    { role: 'assistant', content: currentAnswer },
    { role: 'user', content: `Reviewer feedback:\n${debateRounds[debateRounds.length - 1]?.content || ''}\n\nProvide your final refined answer.` }
  ]

  try {
    currentAnswer = await callWithRetry(primaryAdapter, primaryModel, finalInput, primary.name, 4096)
  } catch (err: any) {
    currentAnswer = currentAnswer || `[${primary.displayName} error on refinement: ${err.message}]`
  }

  debateRounds.push({
    role: 'refiner',
    provider: primary.name,
    model: primaryModel,
    content: currentAnswer,
    label: `${primary.displayName} (final answer)`
  })
  emitStep('Final answer ready', `Refined across ${rounds} round(s) of debate`)

  return { rounds: debateRounds }
}
