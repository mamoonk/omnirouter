import type { QuotaStatus } from '@shared/types'

interface Props {
  status: QuotaStatus
}

export function QuotaBar({ status }: Props) {
  const rpmPct = status.rpmLimit > 0 ? (status.rpmRemaining / status.rpmLimit) * 100 : 0
  const dailyPct = status.dailyTokenLimit > 0 ? (status.dailyTokensRemaining / status.dailyTokenLimit) * 100 : 0
  const hasDailyRequestLimit = status.dailyRequestLimit !== undefined && status.dailyRequestsRemaining !== undefined
  const dailyRequestPct = hasDailyRequestLimit ? (status.dailyRequestsRemaining! / status.dailyRequestLimit!) * 100 : 0

  const getColor = (pct: number) => {
    if (pct > 50) return 'bg-green-500'
    if (pct > 20) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm capitalize">{status.provider}</span>
        {status.degraded && (
          <span className="text-xs text-red-500 font-medium">Degraded</span>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Requests/min</span>
            <span>{status.rpmRemaining} / {status.rpmLimit}</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getColor(rpmPct)}`}
              style={{ width: `${rpmPct}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Daily tokens</span>
            <span>{(status.dailyTokensRemaining / 1000).toFixed(0)}K / {(status.dailyTokenLimit / 1000).toFixed(0)}K</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getColor(dailyPct)}`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
        </div>

        {hasDailyRequestLimit && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Daily requests</span>
              <span>{status.dailyRequestsRemaining} / {status.dailyRequestLimit}</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getColor(dailyRequestPct)}`}
                style={{ width: `${dailyRequestPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
