import { useState } from 'react'
import { FolderOpen, FolderPlus, X, Folder } from 'lucide-react'
import { CodeSession } from './CodeSession'

interface Session {
  id: string
  projectPath: string
  conversationId: string | null
}

interface Props {
  serverPort: number
  onConversationSaved: () => void
  projectId: string | null
}

export function CodeInterface({ serverPort, onConversationSaved, projectId }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const openFolder = async (makeActive = true) => {
    const path = await window.electronAPI?.openFolder()
    if (!path) return
    // Reuse existing session for same path
    const existing = sessions.find(s => s.projectPath === path)
    if (existing) { setActiveId(existing.id); return }
    const id = crypto.randomUUID()
    setSessions(prev => [...prev, { id, projectPath: path, conversationId: null }])
    if (makeActive) setActiveId(id)
  }

  const closeSession = (id: string) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (activeId === id) setActiveId(next.length > 0 ? next[next.length - 1].id : null)
      return next
    })
  }

  const updateConversation = (id: string, conversationId: string | null) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, conversationId } : s))
  }

  // No sessions open — show splash
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-2">Code Agent</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm">
            Open a project folder to start building. The agent reads your code, writes files, and iterates until your app is ready.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => openFolder()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
            <FolderOpen size={16} />
            Open Project
          </button>
          <button onClick={() => openFolder()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors">
            <FolderPlus size={16} />
            New Project
          </button>
        </div>
        <p className="text-xs text-gray-300 dark:text-gray-600">
          Supports TypeScript, Python, Go, Rust, React, Vue, and more
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 overflow-x-auto shrink-0">
        {sessions.map(session => {
          const name = session.projectPath.split(/[/\\]/).pop() || session.projectPath
          const active = session.id === activeId
          return (
            <button
              key={session.id}
              onClick={() => setActiveId(session.id)}
              className={`group flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-r border-gray-200 dark:border-gray-800 shrink-0 transition-colors ${
                active
                  ? 'bg-white dark:bg-gray-950 text-blue-700 dark:text-blue-300 border-b-2 border-b-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Folder size={12} className="shrink-0" />
              <span className="max-w-[120px] truncate">{name}</span>
              <span
                role="button"
                onClick={e => { e.stopPropagation(); closeSession(session.id) }}
                className="ml-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-red-500 transition-opacity"
                title="Close project"
              >
                <X size={11} />
              </span>
            </button>
          )
        })}
        {/* Add project button */}
        <button
          onClick={() => openFolder()}
          title="Open another project"
          className="flex items-center gap-1 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0 transition-colors"
        >
          <FolderPlus size={13} />
          Open
        </button>
      </div>

      {/* Sessions — all rendered, only active one visible */}
      <div className="flex-1 overflow-hidden">
        {sessions.map(session => (
          <CodeSession
            key={session.id}
            serverPort={serverPort}
            projectPath={session.projectPath}
            conversationId={session.conversationId}
            onConversationChange={id => updateConversation(session.id, id)}
            onConversationSaved={onConversationSaved}
            projectId={projectId}
            active={session.id === activeId}
          />
        ))}
      </div>
    </div>
  )
}
