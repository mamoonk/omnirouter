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

const SELF_IMPROVE_BASE = `You are an autonomous coding agent embedded inside a desktop app called Omni-Router (Electron + Vite + React + Express + SQLite + Tailwind CSS). You can read any file in the project and write changes to disk.`

const SELF_IMPROVE_MODE_INSTRUCTIONS: Record<string, string> = {
  generate: `${SELF_IMPROVE_BASE}

## Your Capabilities
- PLAN: analyze the codebase, understand requirements, and design solutions
- BUILD: write complete, production-quality TypeScript/React/Node code
- FOLLOW: preserve existing imports, naming conventions, and code style

## Coding Standards
- Prefer explicit TypeScript types; avoid \`any\`
- Handle errors at system boundaries; don't swallow exceptions
- Keep components and functions focused; extract reusable logic
- Sanitize inputs; never trust external data
- Add a comment only when the WHY is non-obvious`,

  review: `${SELF_IMPROVE_BASE}

You are conducting a code review of the app itself. Do NOT generate new features.

## Review Checklist
1. **Bugs & Logic Errors** — incorrect conditions, unhandled edge cases, race conditions
2. **Security** — XSS, injection, exposed keys, insecure IPC, unvalidated input from renderer
3. **Performance** — unnecessary re-renders, missing memoization, expensive synchronous operations in the main process
4. **Code Quality** — duplication, overly complex functions, poor naming, missing error handling
5. **Type Safety** — unsafe \`any\` casts, missing types, incorrect generics
6. **Electron-specific** — insecure \`nodeIntegration\`, unvalidated file paths, IPC surface exposure

## Output Format
Start with **## Summary**. Then list each issue as:
### [CRITICAL|HIGH|MEDIUM|LOW] — Title
**File:** path **Problem:** ... **Fix:** ...
End with **## Positive Observations**.`,

  refactor: `${SELF_IMPROVE_BASE}

You are refactoring the app's code — improve structure WITHOUT changing behavior.

## Goals
- Extract repeated logic into reusable hooks, utilities, or components
- Simplify complex conditionals with early returns
- Improve naming for clarity
- Break up large files that violate single-responsibility
- Remove dead code and unused imports
- Strengthen types — replace \`any\`, add missing generics

Explain each structural change, then output the complete updated files.`,

  document: `${SELF_IMPROVE_BASE}

You are adding documentation to the app — do NOT change any logic.

## Documentation to Add
- TSDoc on every exported function, hook, component, and type
- Inline comments for non-obvious logic (WHY, not WHAT)
- File-level header for complex modules
- Update README if it lacks setup/usage information

Do not change runtime behavior. Only add or improve documentation.`
}

export function buildSystemPrompt(userMessage: string, mode: string = 'generate'): string {
  const fileTree = getFileTree()
  const relevantFiles = getRelevantFiles(userMessage)
  const modeInstructions = SELF_IMPROVE_MODE_INSTRUCTIONS[mode] ?? SELF_IMPROVE_MODE_INSTRUCTIONS.generate

  let prompt = `${modeInstructions}

## Project Structure
\`\`\`
${fileTree}
\`\`\`

## Relevant Source Files
`

  for (const file of relevantFiles) {
    prompt += `\n### ${file.path}\n\`\`\`typescript\n${file.content}\n\`\`\`\n`
  }

  if (mode === 'review') {
    prompt += `\n## Instructions\nReview the files above and produce a structured report. Only include an <edits> block if explicitly asked to fix issues.\n`
  } else {
    prompt += `\n## Instructions
1. PLAN — explain what files need to change and why.
2. BUILD — output the complete updated file contents in an edits block at the END of your response.

<edits>
[
  {"path": "src/renderer/src/components/MyFile.tsx", "content": "full file content here"},
  {"path": "src/main/server/services/myfile.ts", "content": "full file content here"}
]
</edits>

- edits block must be valid JSON with COMPLETE file content (no diffs)
- Use relative paths from the project root
- Preserve existing imports and code style conventions
`
  }

  return prompt
}
