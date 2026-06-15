interface Props {
  tokensSaved: number
  costAvoided: number
}

export function SavingsCounter({ tokensSaved, costAvoided }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
        <p className="text-xs text-gray-500 mb-1">Tokens Saved (vs. GPT-4)</p>
        <p className="text-2xl font-semibold">{(tokensSaved / 1000000).toFixed(2)}M</p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
        <p className="text-xs text-gray-500 mb-1">Cost Avoided</p>
        <p className="text-2xl font-semibold">${costAvoided.toFixed(2)}</p>
      </div>
    </div>
  )
}
