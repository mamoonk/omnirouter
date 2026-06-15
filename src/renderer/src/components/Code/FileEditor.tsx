import { useState, useEffect, useRef } from 'react'
import { Save, Edit3, X, Check, Copy } from 'lucide-react'
import hljs from 'highlight.js/lib/common'

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  mjs: 'javascript', cjs: 'javascript', py: 'python', go: 'go', rs: 'rust',
  java: 'java', c: 'c', cpp: 'cpp', h: 'cpp', cs: 'csharp',
  css: 'css', scss: 'css', html: 'html', vue: 'xml', svelte: 'xml',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini', md: 'markdown',
  sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql', rb: 'ruby', php: 'php'
}

interface Props {
  filePath: string   // absolute path
  projectRoot: string
  onClose: () => void
  onSaved?: () => void
}

export function FileEditor({ filePath, projectRoot, onClose, onSaved }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fileName = filePath.split(/[/\\]/).pop() || filePath
  const relPath = filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length).replace(/^[/\\]/, '').replace(/\\/g, '/')
    : fileName
  const ext = fileName.includes('.') ? fileName.split('.').pop()! : ''
  const lang = LANG_MAP[ext] || ''

  useEffect(() => {
    setContent(null)
    setError(null)
    setEditing(false)
    window.electronAPI?.readFile(filePath).then(text => {
      setContent(text)
      setDraft(text)
    }).catch(e => setError(e.message || 'Could not read file'))
  }, [filePath])

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  const save = async () => {
    setSaving(true)
    try {
      await window.electronAPI?.writeFile(filePath, draft)
      setContent(draft)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved?.()
    } catch (e: any) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    setDraft(content ?? '')
    setEditing(false)
  }

  const copy = () => {
    navigator.clipboard.writeText(content ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  let highlighted = ''
  if (content !== null) {
    try {
      highlighted = lang && hljs.getLanguage(lang)
        ? hljs.highlight(content, { language: lang }).value
        : hljs.highlightAuto(content, Object.values(LANG_MAP)).value
    } catch {
      highlighted = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 shrink-0">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate" title={relPath}>
          {fileName}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1 hidden sm:block" title={relPath}>
          {relPath !== fileName ? `— ${relPath}` : ''}
        </span>

        {content !== null && !editing && (
          <>
            <button onClick={copy} title="Copy" className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
            </button>
            <button onClick={() => setEditing(true)} title="Edit file"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Edit3 size={12} /> Edit
            </button>
          </>
        )}

        {editing && (
          <>
            <button onClick={save} disabled={saving} title="Save"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors">
              <Save size={12} />
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
            </button>
            <button onClick={discard} title="Discard changes"
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X size={13} />
            </button>
          </>
        )}

        <button onClick={onClose} title="Close"
          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-950">
        {error && (
          <div className="p-4 text-sm text-red-500">{error}</div>
        )}
        {content === null && !error && (
          <div className="p-4 text-xs text-gray-400 animate-pulse">Loading…</div>
        )}
        {content !== null && !editing && (
          <pre className="p-4 text-xs leading-relaxed overflow-auto">
            <code
              className="hljs"
              dangerouslySetInnerHTML={{ __html: highlighted || '(empty file)' }}
            />
          </pre>
        )}
        {editing && (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-full h-full p-4 font-mono text-xs leading-relaxed resize-none outline-none bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        )}
      </div>
    </div>
  )
}
