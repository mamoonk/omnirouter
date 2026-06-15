import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { ChatStatusBar } from './ChatStatusBar'
import { ProviderBadge } from './ProviderBadge'
import { useChat } from '../../hooks/useChat'
import { Code2 } from 'lucide-react'
import type { RoutingStrategy } from '@shared/types'

interface Props {
  serverPort: number
  conversationId: string | null
  onConversationChange: (id: string) => void
  showProviderBadge: boolean
  streamingEnabled: boolean
  projectId: string | null
  onConversationSaved: () => void
  routingStrategy: RoutingStrategy
  onRoutingStrategyChange: (s: RoutingStrategy) => void
  onViewChange: (v: 'chat' | 'dashboard' | 'settings') => void
}

export function ChatInterface({
  serverPort,
  conversationId,
  onConversationChange,
  showProviderBadge,
  streamingEnabled,
  projectId,
  onConversationSaved,
  routingStrategy,
  onRoutingStrategyChange,
  onViewChange
}: Props) {
  const {
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
  } = useChat(serverPort, conversationId, onConversationChange, streamingEnabled, projectId, onConversationSaved)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId)
    } else {
      clearMessages()
    }
  }, [conversationId])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {selfImprove && (
          <div className="mx-4 -mt-2 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-xs text-purple-700 dark:text-purple-300">
            <Code2 size={14} />
            <span><strong>Agent Mode</strong> — I can read and modify the app's source code. Toggle off to chat normally.</span>
          </div>
        )}
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Omni-Router</h2>
              <p className="text-sm">Send a message to start chatting.</p>
              <p className="text-xs mt-1">Automatically routes across 19 AI providers.</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={msg.id || i} message={msg} debateData={i === messages.length - 1 && !streaming ? debateData : null} editResults={i === messages.length - 1 ? editResults : null} live={i === messages.length - 1 && streaming} />
        ))}
        {streaming && showProviderBadge && currentProvider && (
          <ProviderBadge provider={currentProvider} model={currentModel} />
        )}
        {error && (
          <div className="text-red-500 text-sm px-4 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        streaming={streaming}
        selfImprove={selfImprove}
        onToggleSelfImprove={toggleSelfImprove}
        debate={debate}
        onToggleDebate={toggleDebate}
      />
      <ChatStatusBar
        serverPort={serverPort}
        routingStrategy={routingStrategy}
        onRoutingStrategyChange={onRoutingStrategyChange}
      />
    </div>
  )
}
