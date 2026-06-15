import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { app } from 'electron'

const SOURCE_DIRS = ['src']
const INCLUDE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.css', '.sql', '.json', '.js', '.mjs', '.yml', '.yaml'
])
const EXCLUDE_DIRS = new Set([
  'node_modules', 'out', '.git', 'dist', '.vite'
])

export interface FileEntry {
  path: string
  size: number
}

export interface CodebaseContext {
  fileTree: string
  fileContents: Array<{ path: string; content: string }>
}

function getProjectRoot(): string {
  return join(app.getAppPath(), '..')
}

export function getFileTree(): string {
  const root = getProjectRoot()
  const lines: string[] = []
  buildTree(root, '', lines, 0)
  return lines.join('\n')
}

function buildTree(dir: string, prefix: string, lines: string[], depth: number): void {
  if (depth > 4) return

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (EXCLUDE_DIRS.has(entry)) continue
      const fullPath = join(dir, entry)
      const relPath = relative(getProjectRoot(), fullPath)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        lines.push(`${prefix}${entry}/`)
        buildTree(fullPath, `${prefix}  `, lines, depth + 1)
      } else if (INCLUDE_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
        lines.push(`${prefix}${entry}`)
      }
    }
  } catch {
    // permission denied, skip
  }
}

export function getRelevantFiles(query: string): Array<{ path: string; content: string }> {
  const root = getProjectRoot()
  const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  const results: Array<{ path: string; content: string; score: number }> = []
  const maxFileSize = 50_000

  for (const srcDir of SOURCE_DIRS) {
    const dir = join(root, srcDir)
    if (!exists(dir)) continue
    walkFiles(dir, (filePath) => {
      const ext = filePath.slice(filePath.lastIndexOf('.'))
      if (!INCLUDE_EXTENSIONS.has(ext)) return

      const relPath = relative(root, filePath)
      let score = 0

      const name = filePath.toLowerCase()
      for (const kw of keywords) {
        if (name.includes(kw)) score += 3
      }

      if (score === 0) return

      try {
        const content = readFileSync(filePath, 'utf-8')
        if (content.length > maxFileSize) return

        for (const kw of keywords) {
          const idx = content.toLowerCase().indexOf(kw)
          if (idx !== -1) score += 1
        }

        results.push({ path: relPath, content, score })
      } catch {
        // skip unreadable files
      }
    })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, 8).map(({ path, content }) => ({ path, content }))
}

function exists(dir: string): boolean {
  try {
    return statSync(dir).isDirectory()
  } catch {
    return false
  }
}

function walkFiles(dir: string, cb: (filePath: string) => void): void {
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (EXCLUDE_DIRS.has(entry)) continue
      const fullPath = join(dir, entry)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walkFiles(fullPath, cb)
      } else {
        cb(fullPath)
      }
    }
  } catch {
    // skip
  }
}

export function buildSystemPrompt(userMessage: string): string {
  const fileTree = getFileTree()
  const relevantFiles = getRelevantFiles(userMessage)

  let prompt = `You are an autonomous coding agent embedded inside a desktop app called Omni-Router. The user wants you to modify or enhance the app itself. You have the ability to read any file in the project and write changes to disk.

## Your Capabilities
- You can PLAN: analyze the codebase, understand requirements, and design solutions.
- You can BUILD: write code, create new files, modify existing files, and refactor.
- You are a full-stack TypeScript developer (Electron + Vite + React + Express + SQLite + Tailwind CSS).

## Project Structure
\`\`\`
${fileTree}
\`\`\`

## Relevant Source Files
`

  for (const file of relevantFiles) {
    prompt += `\n### ${file.path}\n\`\`\`typescript\n${file.content}\n\`\`\`\n`
  }

  prompt += `\n## Instructions
You are a coding agent. The user's message below is a request to change the app.

1. PLAN: First, explain your approach - what files need to change and why.
2. BUILD: Then output the edits block with the complete file contents.

For each file that needs to be created or modified, output the full file content inside an edits JSON block at the end of your response. Use this exact format:

<edits>
[
  {"path": "src/renderer/src/components/MyFile.tsx", "content": "full file content here"},
  {"path": "src/main/server/services/myfile.ts", "content": "full file content here"}
]
</edits>

Rules:
- Always include the edits block at the END of your response, after your explanation.
- The edits block must be valid JSON and contain the COMPLETE file content for each file (not a diff).
- Use relative paths from the project root.
- For new files, include the full content. For existing files, include the full updated content.
- When modifying code, preserve existing imports and code style conventions.
- After the edits are applied, summarize what was changed.
`

  return prompt
}
