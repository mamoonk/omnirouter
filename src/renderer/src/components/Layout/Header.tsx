import { MessageSquare, Code2, Moon, Sun } from 'lucide-react'

type View = 'chat' | 'code' | 'dashboard' | 'settings'

interface Props {
  view: View
  onViewChange: (v: View) => void
  darkMode: boolean
  onToggleDarkMode: () => void
}

const TABS: Array<{ id: View; label: string; icon: typeof MessageSquare }> = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'code', label: 'Code', icon: Code2 }
]

export function Header({ view, onViewChange, darkMode, onToggleDarkMode }: Props) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const active = view === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            <Icon size={16} />
            {tab.label}
          </button>
        )
      })}

      <div className="ml-auto">
        <button
          onClick={onToggleDarkMode}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </div>
  )
}
