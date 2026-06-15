import { useState } from 'react'
import type { ActivityStep } from '@shared/types'
import {
  Brain,
  Wrench,
  GitBranch,
  Database,
  Server,
  MessagesSquare,
  AlertCircle,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles
} from 'lucide-react'

interface Props {
  steps?: ActivityStep[] | null
  /** True while this message's request is still streaming. */
  live: boolean
}

const KIND_ICON: Record<ActivityStep['kind'], typeof Brain> = {
  think: Brain,
  tool: Wrench,
  route: GitBranch,
  cache: Database,
  provider: Server,
  debate: MessagesSquare,
  error: AlertCircle
}

function StatusIcon({ status }: { status: ActivityStep['status'] }) {
  if (status === 'running') return <Loader2 size={12} className="animate-spin text-blue-500" />
  if (status === 'fail') return <X size={12} className="text-red-500" />
  return <Check size={12} className="text-green-500" />
}

export function ThinkingTrace({ steps, live }: Props) {
  const hasSteps = !!steps && steps.length > 0
  // Collapsed by default — the header shows a live summary; the user expands
  // the full step-by-step trace only if they want the detail.
  const [open, setOpen] = useState(false)

  if (!hasSteps) return null

  const running = steps!.some((s) => s.status === 'running')
  const failed = steps!.filter((s) => s.status === 'fail').length
  const summary = live || running
    ? 'Thinking…'
    : `Worked through ${steps!.length} step${steps!.length === 1 ? '' : 's'}${failed > 0 ? ` · ${failed} failed` : ''}`

  return (
    <div className="mb-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 overflow-hidden">
      <button
        onClick={() => {
          setOpen((o) => !o)
        }}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {running ? (
          <Loader2 size={13} className="animate-spin text-blue-500" />
        ) : (
          <Sparkles size={13} className="text-blue-500" />
        )}
        <span>{summary}</span>
        {open ? <ChevronDown size={13} className="ml-auto" /> : <ChevronRight size={13} className="ml-auto" />}
      </button>
      {open && (
        <ol className="px-3 pb-2 pt-0.5 space-y-1.5">
          {steps!.map((step) => {
            const Icon = KIND_ICON[step.kind] || Brain
            return (
              <li key={step.id} className="flex items-start gap-2 text-xs">
                <Icon size={13} className="mt-0.5 shrink-0 text-gray-400 dark:text-gray-500" />
                <div className="min-w-0 flex-1">
                  <span
                    className={`${
                      step.status === 'fail'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.detail && (
                    <span className="block text-gray-400 dark:text-gray-500 truncate">{step.detail}</span>
                  )}
                </div>
                <span className="mt-0.5 shrink-0">
                  <StatusIcon status={step.status} />
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
