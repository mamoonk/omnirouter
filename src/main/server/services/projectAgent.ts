import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, extname, basename } from 'path'
import type { TreeNode } from '@shared/types'

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', '.tox', 'target', 'vendor',
  '.vite', '.svelte-kit', 'coverage', '.turbo', '.cache'
])

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
  '.css', '.scss', '.sass', '.less',
  '.html', '.vue', '.svelte', '.astro',
  '.json', '.yaml', '.yml', '.toml',
  '.md', '.sql', '.sh', '.bash', '.zsh',
  '.graphql', '.prisma', '.proto', '.rb', '.php', '.swift', '.kt'
])

export function getTreeNodes(root: string, dir?: string, depth = 0): TreeNode[] {
  if (depth > 6) return []
  const nodes: TreeNode[] = []
  try {
    for (const entry of readdirSync(dir ?? root)) {
      if (entry.startsWith('.') && entry !== '.env' && entry !== '.gitignore') continue
      if (EXCLUDE_DIRS.has(entry)) continue
      const full = join(dir ?? root, entry)
      const rel = relative(root, full).replace(/\\/g, '/')
      try {
        const stat = statSync(full)
        if (stat.isDirectory()) {
          nodes.push({ name: entry, path: rel, type: 'dir', children: getTreeNodes(root, full, depth + 1) })
        } else if (CODE_EXTS.has(extname(entry).toLowerCase())) {
          nodes.push({ name: entry, path: rel, type: 'file' })
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function textTree(nodes: TreeNode[], prefix = ''): string {
  return nodes.map((n, i) => {
    const last = i === nodes.length - 1
    const line = `${prefix}${last ? '└── ' : '├── '}${n.name}${n.type === 'dir' ? '/' : ''}`
    const child = n.children ? textTree(n.children, prefix + (last ? '    ' : '│   ')) : ''
    return child ? `${line}\n${child}` : line
  }).join('\n')
}

function relevantFiles(nodes: TreeNode[], root: string, query: string) {
  const kws = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const scored: Array<{ path: string; content: string; score: number }> = []

  function walk(list: TreeNode[]) {
    for (const n of list) {
      if (n.type === 'dir' && n.children) { walk(n.children); continue }
      let score = 0
      const lp = n.path.toLowerCase()
      for (const kw of kws) if (lp.includes(kw)) score += 3
      try {
        const content = readFileSync(join(root, n.path), 'utf-8')
        if (content.length > 80_000) continue
        for (const kw of kws) if (content.toLowerCase().includes(kw)) score += 1
        scored.push({ path: n.path, content, score })
      } catch { /* skip */ }
    }
  }

  walk(nodes)
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 10).map(({ path, content }) => ({ path, content }))
}

export function buildProjectSystemPrompt(userMessage: string, projectRoot: string, nodes: TreeNode[]): string {
  const tree = textTree(nodes)
  const files = relevantFiles(nodes, projectRoot, userMessage)
  const name = basename(projectRoot)

  let prompt = `You are an expert full-stack coding agent working on the project "${name}" located at ${projectRoot}.

## Project Structure
\`\`\`
${tree || '(empty — no files yet)'}
\`\`\`
`

  if (files.length > 0) {
    prompt += '\n## Relevant Files\n'
    for (const f of files) {
      const lang = extname(f.path).slice(1) || 'text'
      prompt += `\n### ${f.path}\n\`\`\`${lang}\n${f.content}\n\`\`\`\n`
    }
  }

  prompt += `
## Instructions
When writing or modifying code, output a single \`<edits>\` block at the END of your response:

<edits>
[
  {"path": "src/App.tsx", "content": "// complete file content here"},
  {"path": "package.json", "content": "{ ... }"}
]
</edits>

Rules:
- Paths are **relative to the project root** (${projectRoot}) — use proper subdirectories
- Always write the **complete** file content — never diffs or partial snippets
- Write your explanation BEFORE the edits block, not after
- **Create a fully runnable project** — include every file needed to run with no extra steps beyond \`npm install\` / \`pip install\` etc.

### Folder structure guidelines
For a **React (CRA/Vite)** project use:
  public/index.html, src/index.tsx, src/App.tsx, src/App.css, package.json, tsconfig.json

For a **React + Vite** project use:
  index.html (root), src/main.tsx, src/App.tsx, package.json, vite.config.ts, tsconfig.json

For a **Node/Express** API use:
  src/index.ts, src/routes/, package.json, tsconfig.json

For a **Python** project use:
  main.py or src/main.py, requirements.txt

For a **plain HTML/JS** site use:
  index.html, style.css, script.js (no build step — immediately openable in a browser)

Prefer **Vite over CRA** for new React projects (faster, no ejecting needed).
`

  return prompt
}
