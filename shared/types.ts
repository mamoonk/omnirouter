export interface ProviderConfig {
  name: string
  displayName: string
  apiKeyEnv: string
  baseUrl: string
  models: ModelDef[]
  rpmLimit: number
  tpmLimit: number
  dailyTokenLimit: number
  tier: 1 | 2 | 3
  adapter: 'openai-compatible' | 'native'
  nativePackage?: string
  enabled: boolean
}

export interface ModelDef {
  id: string
  displayName: string
  contextWindow: number
  strengths: Array<'factual' | 'code' | 'long_doc' | 'creative'>
  capabilities?: Array<'text' | 'image' | 'vision'>
}

export interface CompletionRequest {
  model: string
  messages: Message[]
  stream?: boolean
  maxTokens?: number
  attachments?: Attachment[]
}

export interface CompletionResponse {
  content: string
  model: string
  provider: string
  tokensIn: number
  tokensOut: number
  finishReason: 'stop' | 'length' | 'error'
  latencyMs: number
  imageUrl?: string
  imageData?: string
}

export interface Attachment {
  id: string
  type: 'image' | 'video' | 'audio' | 'file'
  mime: string
  data: string // base64
  name: string
  size: number
}

export interface Message {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  provider?: string
  model?: string
  tokensIn?: number
  tokensOut?: number
  createdAt?: string
  imageUrl?: string
  imageData?: string
  attachments?: Attachment[]
  steps?: ActivityStep[]
}

/**
 * A single observable step in how the router/agent processes a request — used to
 * surface the otherwise-invisible "thinking" and tool usage to the user as it happens.
 */
export interface ActivityStep {
  /** Stable id; a `running` step is later upserted to `done`/`fail` with the same id. */
  id: string
  kind: 'think' | 'tool' | 'route' | 'cache' | 'provider' | 'debate' | 'error'
  /** Short title, e.g. "Ranking providers". */
  label: string
  /** Optional human-readable detail, e.g. "Top pick: gemini (0.87)". */
  detail?: string
  status: 'running' | 'done' | 'fail'
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  projectId?: string | null
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  conversationCount: number
  createdAt: string
}

export interface QuotaWindow {
  provider: string
  requests: number
  tokensIn: number
  tokensOut: number
  windowMinute: string
  windowDay: string
}

export interface QuotaStatus {
  provider: string
  rpmRemaining: number
  rpmLimit: number
  tpmRemaining: number
  tpmLimit: number
  dailyTokensRemaining: number
  dailyTokenLimit: number
  degraded: boolean
  lastError?: string
}

export interface ScoringFactors {
  intentWeight: number
  rpmWeight: number
  dailyWeight: number
  failurePenalty: number
}

export type IntentCategory = 'factual' | 'code' | 'long_doc' | 'creative' | 'image'
export type RoutingStrategy = 'smart' | 'cheapest' | 'fastest' | 'roundrobin'

export interface RouterScore {
  provider: string
  model: string
  score: number
  factors: ScoringFactors
}

export interface QueuedRequest {
  id: string
  conversationId: string
  messages: Message[]
  resolve: (response: CompletionResponse) => void
  reject: (error: Error) => void
  retryAt: number
  attempt: number
}

export interface Settings {
  darkMode: boolean
  showProviderBadge: boolean
  streamingEnabled: boolean
  cacheEnabled: boolean
  compressionEnabled: boolean
  tokenOptimization: boolean
  tokenOptimizationThreshold: number
  providersEnabled: string[]
  apiKeys: Record<string, string>
  routingStrategy: RoutingStrategy
  debateEnabled: boolean
  debateRounds: number
  debatePrimaryProvider?: string
  debateCriticProvider?: string
}

export interface DebateRound {
  role: 'primary' | 'critic' | 'refiner'
  provider: string
  model: string
  content: string
  label?: string
}

export interface DebateData {
  rounds: DebateRound[]
}

export interface TreeNode {
  name: string
  path: string // relative to project root
  type: 'file' | 'dir'
  children?: TreeNode[]
}

export interface SSEMessage {
  type: 'token' | 'done' | 'error' | 'queued' | 'debate' | 'step'
  data: string | number | CompletionResponse | DebateData | ActivityStep
  provider?: string
  model?: string
}
