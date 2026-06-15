import { useState, useEffect, useCallback } from 'react'
import { Header } from './components/Layout/Header'
import { Sidebar } from './components/Layout/Sidebar'
import { ChatInterface } from './components/Chat/ChatInterface'
import { CodeInterface } from './components/Code/CodeInterface'
import { UsageDashboard } from './components/Dashboard/UsageDashboard'
import { SettingsPanel } from './components/Layout/SettingsPanel'
import { useSettings } from './hooks/useSettings'

type View = 'chat' | 'code' | 'dashboard' | 'settings'

export default function App() {
  const [serverPort, setServerPort] = useState(0)
  const [view, setView] = useState<View>('chat')
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

  const { settings, updateSettings } = useSettings(serverPort)

  useEffect(() => {
    const init = async () => {
      if (window.electronAPI) {
        const port = await window.electronAPI.getServerPort()
        setServerPort(port)
        window.electronAPI.onServerPort((p) => setServerPort(p))
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!settings || settings.darkMode === undefined) return
    document.documentElement.classList.toggle('dark', settings.darkMode)
  }, [settings?.darkMode])

  const onNewChat = useCallback(() => {
    setCurrentConversationId(null)
  }, [])

  const onConversationSaved = useCallback(() => {
    setRefreshSignal((s) => s + 1)
  }, [])

  if (!serverPort) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-950 text-gray-500 dark:text-gray-400">
        <p>Connecting...</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar
        serverPort={serverPort}
        currentConversationId={currentConversationId}
        onSelectConversation={setCurrentConversationId}
        onNewChat={onNewChat}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        refreshSignal={refreshSignal}
        view={view}
        onViewChange={setView}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <Header view={view} onViewChange={setView} />
        {view === 'chat' && (
          <ChatInterface
            serverPort={serverPort}
            conversationId={currentConversationId}
            onConversationChange={setCurrentConversationId}
            showProviderBadge={settings?.showProviderBadge ?? true}
            streamingEnabled={settings?.streamingEnabled ?? true}
            projectId={selectedProjectId}
            onConversationSaved={onConversationSaved}
            routingStrategy={settings?.routingStrategy ?? 'smart'}
            onRoutingStrategyChange={(s) => updateSettings({ routingStrategy: s })}
            onViewChange={setView}
          />
        )}
        {view === 'code' && (
          <CodeInterface
            serverPort={serverPort}
            onConversationSaved={onConversationSaved}
            projectId={selectedProjectId}
          />
        )}
        {view === 'dashboard' && (
          <UsageDashboard serverPort={serverPort} />
        )}
        {view === 'settings' && (
          <SettingsPanel
            serverPort={serverPort}
            settings={settings}
            onUpdate={updateSettings}
          />
        )}
      </main>
    </div>
  )
}
