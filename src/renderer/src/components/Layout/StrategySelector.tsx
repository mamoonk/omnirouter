import type { RoutingStrategy } from '@shared/types'
import { Zap, DollarSign, RefreshCw, Sparkles } from 'lucide-react'

interface Props {
  value: RoutingStrategy
  onChange: (value: RoutingStrategy) => void
  dropUp?: boolean
}

const OPTIONS: Array<{ value: RoutingStrategy; label: string; icon: typeof Zap; title: string }> = [
  { value: 'smart', label: 'Smart', icon: Sparkles, title: 'Best provider by intent + quota' },
  { value: 'cheapest', label: 'Cheapest', icon: DollarSign, title: 'Lowest-cost tier providers first' },
  { value: 'fastest', label: 'Fastest', icon: Zap, title: 'Lowest-latency providers first' },
  { value: 'roundrobin', label: 'Round Robin', icon: RefreshCw, title: 'Cycle through providers equally' }
]

export function StrategySelector({ value, onChange, dropUp }: Props) {
  const current = OPTIONS.find((o) => o.value === value) || OPTIONS[0]

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={current.title}
      >
        <current.icon size={14} />
        <span>{current.label}</span>
      </button>
      <div className={`absolute right-0 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 first:rounded-t-xl last:rounded-b-xl ${
              value === opt.value ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'
            }`}
            title={opt.title}
          >
            <opt.icon size={14} />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
