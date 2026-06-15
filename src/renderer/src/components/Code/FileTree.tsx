import { useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react'
import type { TreeNode } from '@shared/types'

interface NodeProps {
  node: TreeNode
  depth: number
  highlight?: Set<string>
  activeFile?: string
  onFileClick?: (path: string) => void
}

function TreeNodeRow({ node, depth, highlight, activeFile, onFileClick }: NodeProps) {
  const [open, setOpen] = useState(depth < 2)
  const isHighlit = highlight?.has(node.path)
  const isActive = activeFile === node.path

  if (node.type === 'file') {
    return (
      <button
        onClick={() => onFileClick?.(node.path)}
        className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-left transition-colors ${
          isActive
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : isHighlit
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        title={node.path}
      >
        <File size={12} className="shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {open ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
        {open ? <FolderOpen size={12} className="shrink-0 text-blue-500" /> : <Folder size={12} className="shrink-0 text-blue-400" />}
        <span className="truncate font-medium">{node.name}</span>
      </button>
      {open && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNodeRow key={child.path} node={child} depth={depth + 1} highlight={highlight} activeFile={activeFile} onFileClick={onFileClick} />
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  nodes: TreeNode[]
  highlightPaths?: string[]
  activeFile?: string
  onFileClick?: (path: string) => void
}

export function FileTree({ nodes, highlightPaths, activeFile, onFileClick }: Props) {
  const highlight = highlightPaths ? new Set(highlightPaths) : undefined

  if (nodes.length === 0) {
    return (
      <div className="p-4 text-xs text-gray-400 dark:text-gray-500 text-center">
        Empty project
      </div>
    )
  }

  return (
    <div className="py-1">
      {nodes.map(node => (
        <TreeNodeRow key={node.path} node={node} depth={0} highlight={highlight} activeFile={activeFile} onFileClick={onFileClick} />
      ))}
    </div>
  )
}
