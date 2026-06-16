import { useState, useEffect } from 'react'
import {
  MessageSquare,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  FolderPlus,
  Folder,
  Inbox,
  Check,
  X,
  ListChecks,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Settings,
  BarChart3,
  LogOut
} from 'lucide-react'
import { ApiClient } from '../../lib/api'
import type { Conversation, Project } from '@shared/types'

type View = 'chat' | 'code' | 'dashboard' | 'settings'

interface Props {
  serverPort: number
  currentConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewChat: () => void
  selectedProjectId: string | null
  onSelectProject: (projectId: string | null) => void
  refreshSignal: number
  view: View
  onViewChange: (v: View) => void
}

export function Sidebar({
  serverPort,
  currentConversationId,
  onSelectConversation,
  onNewChat,
  selectedProjectId,
  onSelectProject,
  refreshSignal,
  view,
  onViewChange
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebarCollapsed') === 'true'
    } catch {
      return false
    }
  })
  const [projectsExpanded, setProjectsExpanded] = useState(() => {
    try {
      return localStorage.getItem('projectsExpanded') !== 'false'
    } catch {
      return true
    }
  })

  const toggleProjectsExpanded = () => {
    setProjectsExpanded((prev) => {
      const next = !prev
      try {
        localStorage.setItem('projectsExpanded', String(next))
      } catch {
        // storage unavailable, keep in-memory only
      }
      return next
    })
  }

  const api = new ApiClient(serverPort)

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sidebarCollapsed', String(next))
      } catch {
        // storage unavailable, keep in-memory only
      }
      return next
    })
  }

  const expand = () => {
    setCollapsed(false)
    try {
      localStorage.setItem('sidebarCollapsed', 'false')
    } catch {
      // storage unavailable, keep in-memory only
    }
  }

  const loadConversations = async () => {
    try {
      setConversations(await api.getConversations(selectedProjectId))
    } catch {
      // not ready yet
    }
  }

  const loadProjects = async () => {
    try {
      setProjects(await api.getProjects())
    } catch {
      // not ready yet
    }
  }

  useEffect(() => {
    loadConversations()
  }, [serverPort, currentConversationId, selectedProjectId, refreshSignal])

  useEffect(() => {
    loadProjects()
  }, [serverPort, currentConversationId, selectedProjectId, refreshSignal])

  // Leave selection mode when the visible set of chats changes.
  useEffect(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [selectedProjectId])

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = conversations.length > 0 && selectedIds.size === conversations.length

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(conversations.map((c) => c.id)))
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const handleDeleteSelected = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    if (!window.confirm(`Delete ${ids.length} selected chat${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    try {
      await api.deleteConversations(ids)
      if (currentConversationId && selectedIds.has(currentConversationId)) onNewChat()
      exitSelectMode()
      loadConversations()
      loadProjects()
    } catch {
      // ignore
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await api.deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
    } catch {
      // ignore
    }
  }

  const handleClearAll = async () => {
    if (conversations.length === 0) return
    const scope = selectedProjectId ? 'this project' : 'all projects'
    if (!window.confirm(`Delete all chats in ${scope}? This cannot be undone.`)) return
    try {
      await api.deleteAllConversations(selectedProjectId)
      setConversations([])
      onNewChat()
      loadProjects()
    } catch {
      // ignore
    }
  }

  const handleCreateProject = async () => {
    const name = newProjectName.trim()
    if (!name) {
      setCreatingProject(false)
      return
    }
    try {
      const created = await api.createProject(name)
      setNewProjectName('')
      setCreatingProject(false)
      // Show it immediately, then reconcile with the server list.
      setProjects((prev) =>
        prev.some((p) => p.id === created.id)
          ? prev
          : [...prev, { id: created.id, name: created.name, conversationCount: 0, createdAt: new Date().toISOString() }]
      )
      onSelectProject(created.id)
      loadProjects()
    } catch (err: any) {
      setCreatingProject(false)
      window.alert(err?.message || 'Could not create project. If you just updated the app, restart it and try again.')
    }
  }

  const handleDeleteProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    if (!window.confirm(`Delete project "${project.name}" and its ${project.conversationCount} chat(s)? This cannot be undone.`)) return
    try {
      await api.deleteProject(project.id)
      if (selectedProjectId === project.id) onSelectProject('default')
      loadProjects()
    } catch {
      // ignore
    }
  }

  const activeProject = projects.find((p) => p.id === selectedProjectId)
  const viewTitle = activeProject ? activeProject.name : selectedProjectId === 'default' ? 'Default' : 'Chats'

  return (
    <div
      className={`${collapsed ? 'w-14' : 'w-64'} bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-in-out`}
    >
      <div className={`flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-800 ${collapsed ? 'justify-center' : ''}`}>
        {!collapsed && (
          <span className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Omni-Router
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
            collapsed ? 'p-2' : 'ml-auto p-1.5'
          }`}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <div className={`border-b border-gray-200 dark:border-gray-800 ${collapsed ? 'p-2' : 'p-3'}`}>
        <button
          onClick={() => { expand(); setProjectsExpanded(true); setCreatingProject(true) }}
          title="New Project"
          className={`flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
            collapsed ? 'w-9 h-9 mx-auto' : 'w-full px-4 py-2'
          }`}
        >
          <FolderPlus size={16} />
          {!collapsed && 'New Project'}
        </button>
      </div>

      {/* Collapsed rail — one icon for chats, one for projects (click to expand) */}
      {collapsed && (
        <div className="p-2 flex flex-col items-center gap-1">
          <button
            onClick={expand}
            title="Chats"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={() => { expand(); setProjectsExpanded(true) }}
            title="Projects"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Folder size={18} />
          </button>
        </div>
      )}

      {/* Projects — full, collapsible section when sidebar is expanded */}
      {!collapsed && (
        <div className="border-b border-gray-200 dark:border-gray-800 p-2">
          <div className="flex items-center gap-1 px-1 py-1">
            <button
              onClick={toggleProjectsExpanded}
              className="flex items-center gap-1 flex-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {projectsExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Projects
              {projects.length > 0 && <span className="text-gray-300 dark:text-gray-600">({projects.length})</span>}
            </button>
          </div>

          {projectsExpanded && creatingProject && (
            <div className="flex items-center gap-1 px-1 py-1">
              <input
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject()
                  if (e.key === 'Escape') {
                    setCreatingProject(false)
                    setNewProjectName('')
                  }
                }}
                placeholder="Project name"
                className="flex-1 min-w-0 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button onClick={handleCreateProject} title="Create" className="p-1 text-green-600 hover:text-green-700">
                <Check size={15} />
              </button>
              <button
                onClick={() => { setCreatingProject(false); setNewProjectName('') }}
                title="Cancel"
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {projectsExpanded &&
            projects.map((project) => {
              const active = project.id === selectedProjectId
              const isDefault = project.id === 'default'
              return (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={`group w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left transition-colors ${
                    active
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {isDefault ? <Inbox size={14} className="shrink-0" /> : <Folder size={14} className="shrink-0" />}
                  <span className="flex-1 truncate">{project.name}</span>
                  <span className="shrink-0 text-xs text-gray-400">{project.conversationCount}</span>
                  {!isDefault && (
                    <Trash2
                      size={14}
                      onClick={(e) => handleDeleteProject(e, project)}
                      className="shrink-0 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  )}
                </button>
              )
            })}
        </div>
      )}

      {/* Conversations toolbar */}
      {!collapsed && !selectMode && (
        <div className="flex items-center gap-1 px-3 pt-2 pb-1">
          <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 truncate">
            {viewTitle}
          </span>
          <button
            onClick={onNewChat}
            title={`New chat in ${viewTitle}`}
            className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Plus size={15} />
          </button>
          {conversations.length > 0 && (
            <>
              <button
                onClick={() => setSelectMode(true)}
                title="Select chats"
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <ListChecks size={14} />
              </button>
              <button
                onClick={handleClearAll}
                title="Delete all chats in this view"
                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Selection toolbar */}
      {!collapsed && selectMode && (
        <div className="flex items-center gap-1 px-3 pt-2 pb-1">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
          </button>
          <span className="flex-1" />
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            title="Delete selected"
            className="p-1 rounded text-gray-400 enabled:hover:text-red-500 enabled:hover:bg-gray-100 dark:enabled:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={exitSelectMode}
            title="Cancel"
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {!collapsed &&
          conversations.map((conv) => {
            const active = conv.id === currentConversationId
            const checked = selectedIds.has(conv.id)
            return (
              <button
                key={conv.id}
                onClick={() => (selectMode ? toggleSelected(conv.id) : onSelectConversation(conv.id))}
                className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  selectMode && checked
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-gray-700 dark:text-gray-200'
                    : !selectMode && active
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                {selectMode ? (
                  checked ? (
                    <CheckSquare size={14} className="shrink-0 text-blue-500" />
                  ) : (
                    <Square size={14} className="shrink-0 text-gray-400" />
                  )
                ) : (
                  <MessageSquare size={14} className="shrink-0" />
                )}
                <span className="flex-1 truncate">{conv.title}</span>
                {!selectMode && (
                  <Trash2
                    size={14}
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="shrink-0 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                )}
              </button>
            )
          })}
      </div>

      {/* Bottom nav: Usage + Settings */}
      <div className={`border-t border-gray-200 dark:border-gray-800 p-2 flex flex-col gap-1 ${collapsed ? 'items-center' : ''}`}>
        <button
          onClick={() => onViewChange('dashboard')}
          title="Usage"
          className={`flex items-center gap-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'dashboard'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
          } ${collapsed ? 'p-2' : 'w-full px-3 py-2'}`}
        >
          <BarChart3 size={16} />
          {!collapsed && 'Usage'}
        </button>
        <button
          onClick={() => onViewChange('settings')}
          title="Settings"
          className={`flex items-center gap-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'settings'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
          } ${collapsed ? 'p-2' : 'w-full px-3 py-2'}`}
        >
          <Settings size={16} />
          {!collapsed && 'Settings'}
        </button>
        {!window.electronAPI && (
          <button
            onClick={() => {
              fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then(() => window.location.reload())
            }}
            title="Log out"
            className={`flex items-center gap-2 rounded-lg text-sm font-medium transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 ${collapsed ? 'p-2' : 'w-full px-3 py-2'}`}
          >
            <LogOut size={16} />
            {!collapsed && 'Log out'}
          </button>
        )}
      </div>
    </div>
  )
}
