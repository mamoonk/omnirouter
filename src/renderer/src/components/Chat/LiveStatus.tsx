import { useEffect, useMemo, useState } from 'react'
import type { ActivityStep } from '@shared/types'
import { Sparkles } from 'lucide-react'

interface Props {
  steps?: ActivityStep[] | null
}

/**
 * A single animated status line shown while a request is in flight (before the
 * answer streams), à la Claude desktop. It reflects the current router/agent
 * activity and rotates friendly phrasing during the longer provider call so the
 * line keeps feeling alive even when the backend is on one step for a while.
 */
export function LiveStatus({ steps }: Props) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2400)
    return () => clearInterval(t)
  }, [])

  const active = useMemo(() => {
    if (!steps || steps.length === 0) return null
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].status === 'running') return steps[i]
    }
    return steps[steps.length - 1]
  }, [steps])

  const message = useMemo(() => {
    if (!active) return 'Getting started'
    switch (active.kind) {
      case 'think':
        return 'Thinking it through'
      case 'cache':
        return 'Checking for a quick answer'
      case 'route':
        return 'Choosing the best model'
      case 'tool':
      case 'debate':
      case 'error':
        return active.label
      case 'provider': {
        const provider = active.label
          .replace(/^Calling\s+/, '')
          .replace(/^Generating image with\s+/, '')
        const pool = [
          `Asking ${provider}`,
          'Reading your question',
          'Composing a response',
          'Connecting the dots',
          'Almost there'
        ]
        return pool[tick % pool.length]
      }
      default:
        return 'Working on it'
    }
  }, [active, tick])

  return (
    <div className="flex items-center gap-2 py-0.5" aria-live="polite">
      <Sparkles size={14} className="text-blue-500 animate-pulse shrink-0" />
      <span className="status-shimmer text-sm font-medium">{message}</span>
      <span className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
    </div>
  )
}
