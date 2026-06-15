import { useState, useEffect } from 'react'
import { QuotaBar } from './QuotaBar'
import { SavingsCounter } from './SavingsCounter'
import { ApiClient } from '../../lib/api'
import type { QuotaStatus } from '@shared/types'

interface Props {
  serverPort: number
}

export function UsageDashboard({ serverPort }: Props) {
  const [quotaStatuses, setQuotaStatuses] = useState<QuotaStatus[]>([])
  const [savings, setSavings] = useState({ tokensSaved: 0, costAvoided: 0 })

  useEffect(() => {
    const api = new ApiClient(serverPort)

    const load = async () => {
      try {
        const [statuses, dashData] = await Promise.all([
          api.getQuotaStatus(),
          api.getDashboard()
        ])
        setQuotaStatuses(statuses)
        setSavings(dashData.savings)
      } catch {
        // ignore
      }
    }

    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [serverPort])

  return (
    <div className="p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-semibold mb-6">Usage Dashboard</h2>

      <SavingsCounter
        tokensSaved={savings.tokensSaved}
        costAvoided={savings.costAvoided}
      />

      <h3 className="text-lg font-medium mb-3 mt-8">Provider Quota</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {quotaStatuses.map((qs) => (
          <QuotaBar key={qs.provider} status={qs} />
        ))}
      </div>
    </div>
  )
}
