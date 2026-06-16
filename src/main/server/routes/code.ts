import { Router } from 'express'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname, normalize, relative } from 'path'
import { exec } from 'child_process'
import { getTreeNodes } from '../services/projectAgent'

export const codeRouter = Router()

codeRouter.get('/tree', (req, res) => {
  const { root } = req.query as { root?: string }
  if (!root) { res.status(400).json({ error: 'root is required' }); return }
  try {
    res.json({ nodes: getTreeNodes(root) })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

codeRouter.post('/apply', (req, res) => {
  const { projectRoot, edits } = req.body as {
    projectRoot: string
    edits: Array<{ path: string; content: string }>
  }
  if (!projectRoot || !Array.isArray(edits)) {
    res.status(400).json({ error: 'projectRoot and edits are required' })
    return
  }
  const root = normalize(projectRoot)
  const results: Array<{ path: string; status: 'written' | 'error'; error?: string }> = []
  for (const edit of edits) {
    const full = join(root, edit.path)
    if (relative(root, normalize(full)).startsWith('..')) {
      results.push({ path: edit.path, status: 'error', error: 'Path escapes project root' })
      continue
    }
    try {
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, edit.content, 'utf-8')
      results.push({ path: edit.path, status: 'written' })
    } catch (err: any) {
      results.push({ path: edit.path, status: 'error', error: err.message })
    }
  }
  res.json({ success: results.every(r => r.status === 'written'), results })
})

codeRouter.post('/lint', (req, res) => {
  const { projectRoot } = req.body as { projectRoot?: string }
  if (!projectRoot) { res.status(400).json({ error: 'projectRoot is required' }); return }

  const root = normalize(projectRoot)
  const tsconfig = join(root, 'tsconfig.json')

  if (!existsSync(tsconfig)) {
    // No TypeScript project — return empty result so the UI skips silently
    res.json({ errors: [], warnings: [], raw: '' })
    return
  }

  // Run tsc with no colour codes so output is easy to parse
  exec('npx tsc --noEmit --pretty false 2>&1', { cwd: root, timeout: 30_000 }, (_err, stdout) => {
    const raw = stdout.trim()
    const lines = raw.split('\n').filter(Boolean)

    const errors: string[] = []
    const warnings: string[] = []

    for (const line of lines) {
      if (/error TS\d+/i.test(line)) errors.push(line)
      else if (/warning TS\d+/i.test(line)) warnings.push(line)
    }

    res.json({ errors, warnings, raw })
  })
})
