import { useState, useCallback, useRef } from 'react'
import { ApiClient } from '../lib/api'
import type { ActivityStep, Attachment, DebateData, Message } from '@shared/types'

export function useChat(
  serverPort: number,
  conversationId: string | null,
  onConversationChange: (id: string) => void,
  streamingEnabled: boolean,
  projectId: string | null,
  onConversationSaved?: () => void,
  codeProjectRoot?: string | null
) {
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentProvider, setCurrentProvider] = useState<string | null>(null)
  const [currentModel, setCurrentModel] = useState<string | null>(null)
  const [selfImprove, setSelfImprove] = useState(false)
  const [debate, setDebate] = useState(false)
  const [debateData, setDebateData] = useState<DebateData | null>(null)
  const [editResults, setEditResults] = useState<{ applied: Array<{ path: string }>; failed: Array<{ path: string; error: string }> } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const pendingRef = useRef(false)
  const selfImproveRef = useRef(false)
  const debateRef = useRef(false)
  const assistantContentRef = useRef('')

  const toggleSelfImprove = useCallback(() => {
    setSelfImprove((prev) => {
      const next = !prev
      selfImproveRef.current = next
      return next
    })
  }, [])

  const toggleDebate = useCallback(() => {
    setDebate((prev) => {
      const next = !prev
      debateRef.current = next
      return next
    })
  }, [])

  const sendMessage = useCallback(async (content: string, attachments?: Attachment[]) => {
    setError(null)
    setStreaming(true)
    setDebateData(null)
    setEditResults(null)
    assistantContentRef.current = ''

    const userMsg: Message = { role: 'user', content, createdAt: new Date().toISOString(), attachments }
    setMessages((prev) => [...prev, userMsg])

    const assistantMsg: Message = { role: 'assistant', content: '', createdAt: new Date().toISOString(), steps: [] }
    setMessages((prev) => [...prev, assistantMsg])

    // Upsert a step (by id) onto the in-flight assistant message so the UI can
    // show "thinking" / tool usage live as the router streams its progress.
    const upsertStep = (step: ActivityStep): void => {
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last.role !== 'assistant') return prev
        const steps = last.steps ? [...last.steps] : []
        const idx = steps.findIndex((s) => s.id === step.id)
        if (idx >= 0) steps[idx] = step
        else steps.push(step)
        updated[updated.length - 1] = { ...last, steps }
        return updated
      })
    }

    const cid = conversationId || crypto.randomUUID()
    if (!conversationId) {
      pendingRef.current = true
      onConversationChange(cid)
    }

    const api = new ApiClient(serverPort)
    const abort = new AbortController()
    abortRef.current = abort

    try {
      await api.sendChat(
        cid,
        content,
        (token, provider, model, debate) => {
          if (provider) setCurrentProvider(provider)
          if (model) setCurrentModel(model)
          if (debate) {
            setDebateData(debate)
            const finalContent = debate.rounds[debate.rounds.length - 1]?.content || ''
            assistantContentRef.current = finalContent
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: finalContent, provider: debate.rounds[0]?.provider, model: debate.rounds[0]?.model }
              }
              return updated
            })
            return
          }
          assistantContentRef.current += token
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + token, provider, model }
            }
            return updated
          })
        },
        { signal: abort.signal, selfImprove: selfImproveRef.current || !!codeProjectRoot, debate: debateRef.current, attachments, onStep: upsertStep, projectId, codeProjectRoot }
      )

      const wasSelfImprove = selfImproveRef.current || !!codeProjectRoot
      if (wasSelfImprove && assistantContentRef.current) {
        const editMatch = assistantContentRef.current.match(/<edits>([\s\S]*?)<\/edits>/)
        if (editMatch) {
          try {
            const edits = JSON.parse(editMatch[1].trim())
            if (Array.isArray(edits) && edits.length > 0) {
              upsertStep({ id: 'agent-apply', kind: 'tool', label: 'Writing file changes', detail: `Applying ${edits.length} edit(s) to disk`, status: 'running' })
              const result = await api.applyEdits(edits, codeProjectRoot)
              const applied = result.results.filter((r) => r.status === 'written')
              const failed = result.results.filter((r) => r.status === 'error')
              upsertStep({
                id: 'agent-apply',
                kind: 'tool',
                label: failed.length > 0 ? 'Wrote file changes (with errors)' : 'Wrote file changes',
                detail: `${applied.length} applied${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
                status: failed.length > 0 ? 'fail' : 'done'
              })
              if (applied.length > 0 || failed.length > 0) {
                setEditResults({
                  applied: applied.map((r) => ({ path: r.path })),
                  failed: failed.map((r) => ({ path: r.path, error: r.error || '' }))
                })
              }
              // In code-project mode, strip the raw <edits> blob from the displayed
              // message — the applied-files summary already shows what changed.
              if (codeProjectRoot) {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content.replace(/<edits>[\s\S]*?<\/edits>/g, '').trim()
                    }
                  }
                  return updated
                })
              }
            }
          } catch {
            // couldn't parse edits, just show the response as-is
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const msg = err.message || 'Request failed'
        setError(msg)
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last.role === 'assistant' && !last.content) {
            updated[updated.length - 1] = { ...last, content: `Error: ${msg}` }
          }
          return updated
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
      setCurrentProvider(null)
      setCurrentModel(null)
      pendingRef.current = false
      // The conversation (and its title) is now persisted — let the sidebar refresh
      // so a chat started inside a project shows up under that project.
      onConversationSaved?.()
      // Resolve any steps still spinning (e.g. aborted/failed stream) so the UI settles.
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant' && last.steps?.some((s) => s.status === 'running')) {
          updated[updated.length - 1] = {
            ...last,
            steps: last.steps.map((s) => (s.status === 'running' ? { ...s, status: 'done' } : s))
          }
        }
        return updated
      })
    }
  }, [serverPort, conversationId, onConversationChange, streamingEnabled, projectId, onConversationSaved, codeProjectRoot])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const loadMessages = useCallback(async (cid: string) => {
    if (pendingRef.current) return
    try {
      const api = new ApiClient(serverPort)
      const msgs = await api.getMessages(cid)
      if (msgs.length > 0) {
        setMessages(msgs)
      }
    } catch {
      // ignore
    }
  }, [serverPort])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    setCurrentProvider(null)
    setCurrentModel(null)
    pendingRef.current = false
  }, [])

  return {
    messages,
    streaming,
    error,
    currentProvider,
    currentModel,
    selfImprove,
    debate,
    debateData,
    editResults,
    sendMessage,
    stopStreaming,
    loadMessages,
    clearMessages,
    toggleSelfImprove,
    toggleDebate
  }
}