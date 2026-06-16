import type {
  ActivityStep,
  AgentMode,
  Attachment,
  CompletionResponse,
  Conversation,
  DebateData,
  Message,
  Project,
  QuotaStatus,
  Settings,
  SSEMessage,
  TreeNode
} from '@shared/types'

function parseSSEMessage(data: string): { type: string; data: string; provider?: string; model?: string } | null {
  try {
    const msg = JSON.parse(data) as SSEMessage
    return {
      type: msg.type,
      data: typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data),
      provider: msg.provider,
      model: msg.model
    }
  } catch {
    return null
  }
}

export class ApiClient {
  private baseUrl: string

  constructor(port: number) {
    // Under Electron, the renderer is loaded from a file:// or dev-server origin
    // and must reach the embedded server via its OS-assigned localhost port. In
    // the browser-hosted web build there is no electronAPI/port discovery — the
    // server serves the same origin the page was loaded from, so requests are relative.
    this.baseUrl = typeof window !== 'undefined' && window.electronAPI ? `http://localhost:${port}` : ''
  }

  /** Sends the session cookie on every request — required for the multi-tenant web build. */
  private request(url: string, init?: RequestInit): Promise<Response> {
    return fetch(url, { ...init, credentials: 'include' })
  }

  async sendChat(
    conversationId: string,
    content: string,
    onToken: (token: string, provider?: string, model?: string, debate?: DebateData) => void,
    options?: { signal?: AbortSignal; selfImprove?: boolean; debate?: boolean; attachments?: Attachment[]; onStep?: (step: ActivityStep) => void; onDone?: (response: CompletionResponse) => void; projectId?: string | null; codeProjectRoot?: string | null; agentMode?: AgentMode }
  ): Promise<void> {
    const res = await this.request(`${this.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, content, selfImprove: options?.selfImprove || false, debate: options?.debate || false, attachments: options?.attachments, projectId: options?.projectId ?? null, codeProjectRoot: options?.codeProjectRoot ?? null, agentMode: options?.agentMode ?? 'generate' }),
      signal: options?.signal
    })

    if (!res.ok || !res.body) {
      throw new Error(`Chat request failed: ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const parsed = parseSSEMessage(line.slice(6))
          if (!parsed) continue
          const { type, data, provider, model } = parsed
          if (type === 'token') {
            onToken(data, provider, model)
          } else if (type === 'step') {
            try {
              options?.onStep?.(JSON.parse(data) as ActivityStep)
            } catch {
              // malformed step, ignore
            }
          } else if (type === 'debate') {
            const debateData = JSON.parse(data) as DebateData
            onToken('', '', '', debateData)
          } else if (type === 'error') {
            throw new Error(data)
          } else if (type === 'done') {
            // For image responses the server skips token streaming entirely and puts
            // the full CompletionResponse (with imageUrl/imageData) only in this event.
            try {
              options?.onDone?.(JSON.parse(data) as CompletionResponse)
            } catch {
              // malformed done payload, ignore
            }
          }
        }
      }
    }
  }

  async getConversations(projectId?: string | null): Promise<Conversation[]> {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
    const res = await this.request(`${this.baseUrl}/api/chat/conversations${qs}`)
    return res.json()
  }

  async deleteAllConversations(projectId?: string | null): Promise<void> {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
    await this.request(`${this.baseUrl}/api/chat/conversations${qs}`, { method: 'DELETE' })
  }

  async deleteConversations(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    try {
      const res = await this.request(`${this.baseUrl}/api/chat/conversations/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      })
      if (res.ok) return
    } catch {
      // fall through to per-conversation deletes
    }
    // Fallback: delete each via the long-standing per-conversation endpoint,
    // so multi-delete works even if the batch route isn't available.
    await Promise.all(ids.map((id) => this.deleteConversation(id)))
  }

  async getProjects(): Promise<Project[]> {
    const res = await this.request(`${this.baseUrl}/api/projects`)
    return res.json()
  }

  async createProject(name: string): Promise<{ id: string; name: string }> {
    const res = await this.request(`${this.baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (!res.ok) {
      throw new Error(`Failed to create project: ${res.status}`)
    }
    return res.json()
  }

  async renameProject(id: string, name: string): Promise<void> {
    await this.request(`${this.baseUrl}/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`${this.baseUrl}/api/projects/${id}`, { method: 'DELETE' })
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const res = await this.request(`${this.baseUrl}/api/chat/conversations/${conversationId}/messages`)
    const rows = (await res.json()) as Array<Record<string, unknown>>
    // `attachments` is persisted as a JSON string; parse it back into an array so
    // the UI never tries to call array methods on a raw string (which crashes render).
    return rows.map((row) => {
      let attachments: Attachment[] | undefined
      if (typeof row.attachments === 'string' && row.attachments) {
        try {
          const parsed = JSON.parse(row.attachments)
          attachments = Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined
        } catch {
          attachments = undefined
        }
      } else if (Array.isArray(row.attachments)) {
        attachments = row.attachments as Attachment[]
      }
      return { ...row, attachments } as Message
    })
  }

  async getChatStatus(): Promise<{
    totalTokens: number
    totalRequests: number
    costAvoided: number
    tokensOptimized: number
    tokenCapacityRemaining: number
    tokenCapacityTotal: number
    providersAvailable: number
    modelsAvailable: number
  }> {
    const res = await this.request(`${this.baseUrl}/api/status`)
    return res.json()
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.request(`${this.baseUrl}/api/chat/conversations/${conversationId}`, { method: 'DELETE' })
  }

  async getQuotaStatus(): Promise<QuotaStatus[]> {
    const res = await this.request(`${this.baseUrl}/api/quota`)
    return res.json()
  }

  async getDashboard(): Promise<any> {
    const res = await this.request(`${this.baseUrl}/api/dashboard`)
    return res.json()
  }

  async getSettings(): Promise<Settings> {
    const res = await this.request(`${this.baseUrl}/api/settings`)
    return res.json()
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    const res = await this.request(`${this.baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    return res.json()
  }

  async getApiKeys(): Promise<Record<string, boolean>> {
    const res = await this.request(`${this.baseUrl}/api/settings/keys`)
    return res.json()
  }

  async saveApiKeys(keys: Record<string, string>): Promise<Record<string, boolean>> {
    const res = await this.request(`${this.baseUrl}/api/settings/keys`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keys)
    })
    return res.json()
  }

  async applyEdits(edits: Array<{ path: string; content: string }>, projectRoot?: string | null): Promise<{ success: boolean; results: Array<{ path: string; status: string; error?: string }> }> {
    if (projectRoot) {
      const res = await this.request(`${this.baseUrl}/api/code/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRoot, edits })
      })
      return res.json()
    }
    const res = await this.request(`${this.baseUrl}/api/self-improve/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edits })
    })
    return res.json()
  }

  async getCodeTree(root: string): Promise<TreeNode[]> {
    const res = await this.request(`${this.baseUrl}/api/code/tree?root=${encodeURIComponent(root)}`)
    const data = await res.json()
    return data.nodes as TreeNode[]
  }

  async lintProject(projectRoot: string): Promise<{ errors: string[]; warnings: string[]; raw: string }> {
    const res = await this.request(`${this.baseUrl}/api/code/lint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectRoot })
    })
    return res.json()
  }
}
