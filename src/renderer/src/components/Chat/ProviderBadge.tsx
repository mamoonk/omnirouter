interface Props {
  provider: string
  model: string | null
}

const PROVIDER_COLORS: Record<string, string> = {
  gemini: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  groq: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  openai: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  anthropic: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  mistral: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  cohere: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  deepseek: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
}

export function ProviderBadge({ provider, model }: Props) {
  const colorClass = PROVIDER_COLORS[provider] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'

  return (
    <div className="flex justify-center">
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {provider}
        {model ? ` · ${model}` : ''}
      </span>
    </div>
  )
}
