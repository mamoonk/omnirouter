import { useState, useEffect, useRef } from 'react'
import { ApiClient } from '../../lib/api'
import { Coins, Route, Dices, Zap, Gauge } from 'lucide-react'
import { StrategySelector } from '../Layout/StrategySelector'
import type { RoutingStrategy } from '@shared/types'

interface Props {
  serverPort: number
  routingStrategy: RoutingStrategy
  onRoutingStrategyChange: (s: RoutingStrategy) => void
}

/** Compact token formatter: 1_500_000 → "1.5M", 100_000 → "100K". */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return `${n}`
}

export function ChatStatusBar({ serverPort, routingStrategy, onRoutingStrategyChange }: Props) {
  const [totalTokens, setTotalTokens] = useState(0)
  const [totalRequests, setTotalRequests] = useState(0)
  const [costAvoided, setCostAvoided] = useState(0)
  const [tokensOptimized, setTokensOptimized] = useState(0)
  const [capacityRemaining, setCapacityRemaining] = useState(0)
  const [capacityTotal, setCapacityTotal] = useState(0)
  const [providersAvailable, setProvidersAvailable] = useState(0)
  const [modelsAvailable, setModelsAvailable] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const api = new ApiClient(serverPort)

    const load = async () => {
      try {
        const data = await api.getChatStatus()
        if (!mountedRef.current) return
        setTotalTokens(data.totalTokens)
        setTotalRequests(data.totalRequests)
        setCostAvoided(data.costAvoided)
        setTokensOptimized(data.tokensOptimized)
        setCapacityRemaining(data.tokenCapacityRemaining)
        setCapacityTotal(data.tokenCapacityTotal)
        setProvidersAvailable(data.providersAvailable)
        setModelsAvailable(data.modelsAvailable)
      } catch {
        // ignore
      }
    }

    load()
    const interval = setInterval(load, 5000)
    return () => { mountedRef.current = false; clearInterval(interval) }
  }, [serverPort])

  const capacityPct = capacityTotal > 0 ? Math.round((capacityRemaining / capacityTotal) * 100) : 0
  const capacityColor = capacityPct > 50 ? 'text-green-500' : capacityPct > 15 ? 'text-amber-500' : 'text-red-500'

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
      <span className="flex items-center gap-1">
        <Coins size={12} />
        {(totalTokens / 1000).toFixed(0)}K tokens
      </span>
      <span className="flex items-center gap-1">
        <Route size={12} />
        {totalRequests} routed
      </span>
      <span className="flex items-center gap-1">
        <Dices size={12} />
        ~${costAvoided.toFixed(2)} saved
      </span>
      <span className={`flex items-center gap-1 ${tokensOptimized > 0 ? 'text-green-500' : ''}`}>
        <Zap size={12} />
        {(tokensOptimized / 1000).toFixed(0)}K optimized
      </span>
      <span className="flex items-center" title="Routing strategy">
        <StrategySelector value={routingStrategy} onChange={onRoutingStrategyChange} dropUp />
      </span>
      <span
        className={`flex items-center gap-1 ml-auto ${capacityColor}`}
        title={`Daily token capacity left across ${providersAvailable} provider${providersAvailable === 1 ? '' : 's'} and ${modelsAvailable} model${modelsAvailable === 1 ? '' : 's'} you have keys for`}
      >
        <Gauge size={12} />
        {formatTokens(capacityRemaining)} / {formatTokens(capacityTotal)} free ({capacityPct}%)
      </span>
    </div>
  )
}
