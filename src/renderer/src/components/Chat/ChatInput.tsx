import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Square, Code2, Brain, Paperclip, X } from 'lucide-react'
import type { Attachment } from '@shared/types'

interface Props {
  onSend: (content: string, attachments?: Attachment[]) => void
  onStop: () => void
  streaming: boolean
  selfImprove: boolean
  onToggleSelfImprove: () => void
  debate: boolean
  onToggleDebate: () => void
  placeholder?: string
}

const MIME_PATTERN = /^(image|video|audio)\//

export function ChatInput({ onSend, onStop, streaming, selfImprove, onToggleSelfImprove, debate, onToggleDebate, placeholder }: Props) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return
    const newAttachments: Attachment[] = []
    for (const file of Array.from(files)) {
      const mimeMatch = file.type.match(MIME_PATTERN)
      const bytes = await file.arrayBuffer()
      const base64 = btoa(new Uint8Array(bytes).reduce((d, b) => d + String.fromCharCode(b), ''))
      newAttachments.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: mimeMatch ? mimeMatch[1] as 'image' | 'video' | 'audio' : 'file',
        mime: file.type || 'application/octet-stream',
        data: base64,
        name: file.name,
        size: file.size
      })
    }
    setAttachments((prev) => [...prev, ...newAttachments])
  }, [])

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleSend = () => {
    const trimmed = input.trim()
    if ((!trimmed && attachments.length === 0) || streaming) return
    onSend(trimmed, attachments.length > 0 ? attachments : undefined)
    setInput('')
    setAttachments([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4">
      <div className="max-w-4xl mx-auto">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((a) => (
              <div key={a.id} className="relative group rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
                {a.type === 'image' ? (
                  <img src={`data:${a.mime};base64,${a.data}`} alt={a.name} className="w-20 h-20 object-cover" />
                ) : (
                  <div className="w-20 h-20 flex items-center justify-center text-xs text-gray-500 truncate px-1">{a.name}</div>
                )}
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1">
          <button
            onClick={onToggleSelfImprove}
            className={`shrink-0 rounded-xl p-3 transition-colors ${
              selfImprove
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title={selfImprove ? 'Self-improvement mode ON' : 'Self-improvement mode OFF'}
          >
            <Code2 size={18} />
          </button>
          <button
            onClick={onToggleDebate}
            className={`shrink-0 rounded-xl p-3 transition-colors ${
              debate
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title={debate ? 'Debate mode ON' : 'Debate mode OFF'}
          >
            <Brain size={18} />
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="shrink-0 rounded-xl p-3 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Attach files"
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? (debate ? 'Ask multiple models to debate...' : selfImprove ? 'Ask me to modify the app...' : 'Send a message...')}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
          />
          {streaming ? (
            <button
              onClick={onStop}
              className="shrink-0 rounded-xl bg-red-500 p-3 text-white hover:bg-red-600 transition-colors"
              title="Stop"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && attachments.length === 0}
              className="shrink-0 rounded-xl bg-blue-500 p-3 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Send"
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
