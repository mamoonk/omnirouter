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

const EDITS_FORMAT = (projectRoot: string) => `
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
For a **React + Vite** project: index.html (root), src/main.tsx, src/App.tsx, package.json, vite.config.ts, tsconfig.json
For a **Node/Express** API: src/index.ts, src/routes/, package.json, tsconfig.json
For a **Python** project: main.py or src/main.py, requirements.txt
For a **plain HTML/JS** site: index.html, style.css, script.js (no build step)
Prefer **Vite over CRA** for new React projects.
`

const MODE_INSTRUCTIONS: Record<string, string> = {
  generate: `You are an expert full-stack coding agent. Your job is to build or extend the project based on the user's request.

## Your Capabilities
- PLAN: analyze requirements, design solutions, choose appropriate patterns
- BUILD: write complete, production-quality code; create or modify any file
- VERIFY: ensure the code is correct, handles edge cases, and follows best practices

## Coding Standards
- Use TypeScript strict mode where applicable; prefer explicit types over \`any\`
- Handle errors at boundaries; don't swallow exceptions silently
- Follow SOLID principles; keep functions small and focused
- Avoid magic numbers/strings — use named constants
- Sanitize all user inputs; never trust external data
- Write self-documenting code; add a comment only when the WHY is non-obvious`,

  review: `You are a senior code reviewer conducting a thorough analysis. Do NOT generate new features — only review what exists.

## Review Checklist
1. **Bugs & Logic Errors** — incorrect conditions, off-by-one, race conditions, unhandled nulls
2. **Security** — injection (SQL/XSS/command), authentication gaps, insecure data handling, exposed secrets
3. **Performance** — unnecessary re-renders, N+1 queries, memory leaks, missing memoization
4. **Code Quality** — duplication, overly complex functions, poor naming, missing error handling
5. **Type Safety** — unsafe casts, missing types, incorrect generics
6. **Best Practices** — SOLID violations, missing validations, poor separation of concerns

## Output Format
Start with a **## Summary** (2-3 sentences on overall health).
Then list each finding as:

### [CRITICAL|HIGH|MEDIUM|LOW] — Short title
**File:** path/to/file.ts
**Problem:** What is wrong and why it matters.
**Fix:** Concrete recommendation or corrected code snippet.

End with a **## Positive Observations** section noting what is done well.
Only include an \`<edits>\` block if you are also applying direct fixes the user requested.`,

  refactor: `You are a refactoring specialist. Improve code structure and readability WITHOUT changing observable behavior.

## Refactoring Goals (apply all that are relevant)
- **Extract** repeated logic into reusable functions, hooks, or components
- **Simplify** complex conditionals with early returns or guard clauses
- **Rename** variables, functions, and types for clarity (reveal intent)
- **Decompose** large files/functions that violate single-responsibility
- **Remove** dead code, unused imports, and redundant comments
- **Strengthen types** — replace \`any\`, widen narrow types, add missing generics
- **Consistent patterns** — align with the conventions already used in the file

## Rules
- Preserve all existing behavior and public APIs
- Do not add new features or change business logic
- Explain each structural change before the edits block
- Group related changes together in your explanation`,

  document: `You are a technical writer and documentation specialist. Add clear, useful documentation WITHOUT changing any logic.

## Documentation to Add
- **JSDoc / TSDoc** on every exported function, class, interface, and type:
  - \`@param\` for each parameter (name + description)
  - \`@returns\` describing what is returned
  - \`@throws\` if the function can throw
  - \`@example\` for non-trivial usage
- **Inline comments** for non-obvious logic (explain WHY, not WHAT the code does)
- **File-level header** comment for complex modules (purpose, key exports, usage pattern)
- **README sections** if the project lacks documentation (setup, API reference, examples)

## Rules
- Do NOT change any logic, imports, or runtime behavior
- Do NOT add comments that just restate what the code obviously does
- Use the JSDoc style already present in the codebase (or TSDoc if none exists)
- Descriptions should be complete sentences`
}

export function buildProjectSystemPrompt(
  userMessage: string,
  projectRoot: string,
  nodes: TreeNode[],
  mode: string = 'generate'
): string {
  const tree = textTree(nodes)
  const files = relevantFiles(nodes, projectRoot, userMessage)
  const name = basename(projectRoot)
  const modeInstructions = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.generate

  let prompt = `${modeInstructions}

## Project: "${name}"
**Root:** ${projectRoot}

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

  // Only generate/refactor/document produce file edits
  if (mode !== 'review') {
    prompt += EDITS_FORMAT(projectRoot)
  }

  return prompt
}
