import { Router } from 'express'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname, normalize, relative } from 'path'
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
