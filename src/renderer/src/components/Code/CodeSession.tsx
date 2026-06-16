import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCw, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { MessageBubble } from '../Chat/MessageBubble'
import { ChatInput } from '../Chat/ChatInput'
import { FileTree } from './FileTree'
import { FileEditor } from './FileEditor'
import { useChat } from '../../hooks/useChat'
import { ApiClient } from '../../lib/api'
import type { TreeNode } from '@shared/types'

interface Props {
  serverPort: number
  projectPath: string
  conversationId: string | null
  onConversationChange: (id: string | null) => void
  onConversationSaved: () => void
  projectId: string | null
  active: boolean
}

export function CodeSession({
  serverPort,
  projectPath,
  conversationId,
  onConversationChange,
  onConversationSaved,
  projectId,
  active
}: Props) {
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeCollapsed, setTreeCollapsed] = useState(false)
  const [recentlyWritten, setRecentlyWritten] = useState<string[]>([])
  const [openFilePath, setOpenFilePath] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Convert relative tree path → absolute path
  const absPath = (rel: string) => `${projectPath.replace(/\\/g, '/')}/${rel}`
  // Convert absolute → relative for active-file highlight in tree
  const relPath = (abs: string) => abs.startsWith(projectPath)
    ? abs.slice(projectPath.length).replace(/^[/\\]/, '').replace(/\\/g, '/')
    : abs

  const refreshTree = useCallback(async () => {
    setTreeLoading(true)
    try {
      const api = new ApiClient(serverPort)
      setTreeNodes(await api.getCodeTree(projectPath))
    } catch { /* ignore */ } finally {
      setTreeLoading(false)
    }
  }, [serverPort, projectPath])

  const {
    messages,
    streaming,
    error,
    editResults,
    lintResults,
    agentMode,
    changeAgentMode,
    sendMessage,
    stopStreaming,
    loadMessages,
    clearMessages
  } = useChat(
    serverPort,
    conversationId,
    (id) => onConversationChange(id),
    true,
    projectId,
    () => { onConversationSaved(); refreshTree() },
    projectPath
  )

  useEffect(() => { refreshTree() }, [projectPath])

  useEffect(() => {
    if (conversationId) loadMessages(conversationId)
    else clearMessages()
  }, [conversationId])

  useEffect(() => {
    if (active) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, active])

  useEffect(() => {
    if (!editResults?.applied?.length) return
    const paths = editResults.applied.map(r => r.path)
    setRecentlyWritten(paths)
    // Auto-open the last written file in the editor pane
    const lastAbs = absPath(paths[paths.length - 1])
    setOpenFilePath(lastAbs)
    const t = setTimeout(() => setRecentlyWritten([]), 4000)
    return () => clearTimeout(t)
  }, [editResults])

  const projectName = projectPath.split(/[/\\]/).pop() || projectPath

  return (
    <div className={`flex flex-col h-full overflow-hidden ${active ? '' : 'hidden'}`}>
      {/* Session toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 shrink-0">
        <button
          onClick={() => setTreeCollapsed(v => !v)}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={treeCollapsed ? 'Show file tree' : 'Hide file tree'}
        >
          {treeCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 truncate flex-1" title={projectPath}>
          {projectName}
          <span className="ml-1.5 font-normal text-gray-400 dark:text-gray-500 hidden sm:inline">{projectPath}</span>
        </span>
        <button onClick={refreshTree} disabled={treeLoading} title="Refresh file tree"
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors">
          <RefreshCw size={13} className={treeLoading ? 'animate-spin' : ''} />
        </button>
        <button onClick={() => { clearMessages(); onConversationChange(null) }} title="New conversation"
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <Plus size={13} />
        </button>
      </div>

      {/* Body: file tree | [editor (top) / chat (bottom)] */}
      <div className="flex flex-1 overflow-hidden">
        {!treeCollapsed && (
          <div className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-y-auto bg-gray-50 dark:bg-gray-900/40">
            <FileTree
              nodes={treeNodes}
              highlightPaths={recentlyWritten}
              activeFile={openFilePath ? relPath(openFilePath) : undefined}
              onFileClick={(rel) => setOpenFilePath(absPath(rel))}
            />
          </div>
        )}

        {/* Vertical split: editor on top, chat on bottom */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {openFilePath && (
            <div className="h-[50%] shrink-0 border-b border-gray-200 dark:border-gray-800 overflow-hidden">
              <FileEditor
                filePath={openFilePath}
                projectRoot={projectPath}
                onClose={() => setOpenFilePath(null)}
                onSaved={refreshTree}
              />
            </div>
          )}

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <p className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-1">{projectName}</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">Describe what you want to build or change.</p>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id || i}
                  message={msg}
                  debateData={null}
                  editResults={i === messages.length - 1 ? editResults : null}
                  live={i === messages.length - 1 && streaming}
                />
              ))}
              {error && (
                <div className="text-red-500 text-sm px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">{error}</div>
              )}
              <div ref={bottomRef} />
            </div>
            {lintResults && lintResults.errors.length > 0 && (
              <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-red-700 dark:text-red-400">
                    {lintResults.errors.length} type error{lintResults.errors.length !== 1 ? 's' : ''} after last edit
                  </span>
                  <button
                    onClick={() => sendMessage(`The TypeScript compiler found these errors after the last edit. Please fix all of them:\n\n\`\`\`\n${lintResults.raw}\n\`\`\``)}
                    disabled={streaming}
                    className="shrink-0 px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
                  >
                    Ask agent to fix
                  </button>
                </div>
                <pre className="mt-1.5 text-red-600 dark:text-red-400 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">{lintResults.errors.slice(0, 5).join('\n')}{lintResults.errors.length > 5 ? `\n… and ${lintResults.errors.length - 5} more` : ''}</pre>
              </div>
            )}
            <ChatInput
              onSend={sendMessage}
              onStop={stopStreaming}
              streaming={streaming}
              selfImprove={false}
              onToggleSelfImprove={() => {}}
              debate={false}
              onToggleDebate={() => {}}
              agentMode={agentMode}
              onAgentModeChange={changeAgentMode}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
