import type { DebateData, Message, DebateRound } from '@shared/types'
import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import { Copy, Check, ChevronDown, ChevronRight, FileText, Film, Code2 } from 'lucide-react'
import { ThinkingTrace } from './ThinkingTrace'
import { LiveStatus } from './LiveStatus'

// Map common fenced-code labels to highlight.js language ids.
const LANG_ALIAS: Record<string, string> = {
  tsx: 'typescript',
  jsx: 'javascript',
  ts: 'typescript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  py: 'python'
}

interface Props {
  message: Message
  debateData?: DebateData | null
  editResults?: { applied: Array<{ path: string }>; failed: Array<{ path: string; error: string }> } | null
  /** True while this (last) assistant message is still streaming. */
  live?: boolean
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Highlight by the declared language when known, otherwise auto-detect.
  const { html, detected } = useMemo(() => {
    const lang = LANG_ALIAS[language] || language
    try {
      if (lang && hljs.getLanguage(lang)) {
        return { html: hljs.highlight(code, { language: lang }).value, detected: lang }
      }
      const auto = hljs.highlightAuto(code)
      return { html: auto.value, detected: auto.language || '' }
    } catch {
      return { html: null as string | null, detected: '' }
    }
  }, [code, language])

  return (
    <div className="not-prose my-2 rounded-xl overflow-hidden border border-gray-700">
      <div className="flex items-center justify-between bg-[#161b22] px-4 py-2 text-xs text-gray-400 border-b border-gray-700">
        <span>{language || detected || 'code'}</span>
        <button onClick={handleCopy} className="hover:text-white transition-colors">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="overflow-x-auto text-sm leading-relaxed">
        {html != null ? (
          <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code className="hljs">{code}</code>
        )}
      </pre>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const components = useMemo(() => ({
    code({ inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '')
      const lang = match ? match[1] : ''
      const code = String(children).replace(/\n$/, '')
      if (!inline) {
        return <CodeBlock language={lang} code={code} />
      }
      return <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-sm" {...props}>{children}</code>
    },
    // Unwrap react-markdown's default <pre> so the highlighted CodeBlock isn't
    // nested inside (and styled by) a prose <pre>.
    pre({ children }: any) {
      return <>{children}</>
    },
  }), [])

  if (!content) return null

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

function DebateRoundCard({ round, index }: { round: DebateRound; index: number }) {
  const [open, setOpen] = useState(index === 0)

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg mb-2 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{round.label || round.role}</span>
        <span className="text-gray-400 ml-auto">{round.provider} · {round.model}</span>
      </button>
      {open && (
        <div className="px-3 py-2">
          <MarkdownContent content={round.content} />
        </div>
      )}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
      title="Copy message"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

export function MessageBubble({ message, debateData, editResults, live = false }: Props) {
  const isUser = message.role === 'user'
  const hasImage = !isUser && (message.imageUrl || message.imageData)

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative group max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-500 text-white rounded-br-sm'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
        }`}
      >
        
        {!isUser && <ThinkingTrace steps={message.steps} live={live} />}
        {debateData && !isUser && (
          <div className="mb-3">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">Multi-model debate</p>
            {debateData.rounds.map((round, i) => (
              <DebateRoundCard key={i} round={round} index={i} />
            ))}
          </div>
        )}
        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {message.attachments.map((a) => (
              <div key={a.id} className="rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                {a.type === 'image' ? (
                  <img src={`data:${a.mime};base64,${a.data}`} alt={a.name} className="max-w-48 max-h-48 object-contain" />
                ) : a.type === 'video' ? (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs bg-gray-100 dark:bg-gray-800">
                    <Film size={14} />
                    <span className="truncate max-w-32">{a.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs bg-gray-100 dark:bg-gray-800">
                    <FileText size={14} />
                    <span className="truncate max-w-32">{a.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {editResults && !isUser && (
          <div className="mb-3 p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1.5 flex items-center gap-1.5">
              <Code2 size={12} />
              Agent — Applied Changes
            </p>
            <div className="space-y-0.5">
              {editResults.applied.map((r) => (
                <p key={r.path} className="text-xs text-green-600 dark:text-green-400">✅ {r.path}</p>
              ))}
              {editResults.failed.map((r) => (
                <p key={r.path} className="text-xs text-red-500">❌ {r.path}: {r.error}</p>
              ))}
            </div>
          </div>
        )}
        {hasImage ? (
          <div className="space-y-2">
            {message.imageData && (
              <img
                src={`data:image/png;base64,${message.imageData}`}
                alt="Generated image"
                className="w-full rounded-lg"
              />
            )}
            {message.imageUrl && !message.imageData && (
              <img
                src={message.imageUrl}
                alt="Generated image"
                className="w-full rounded-lg"
              />
            )}
            <MarkdownContent content={message.content} />
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : live && !message.content ? (
          <LiveStatus steps={message.steps} />
        ) : (
          <MarkdownContent content={message.content} />
        )}
        {message.provider && !debateData && (
          <p className={`text-xs mt-2 ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
            {message.provider}{message.model ? ` · ${message.model}` : ''}
          </p>
        )}
        <div className="flex justify-end">
          <CopyButton text={message.content} />
        </div>
      </div>
    </div>
  )
}
