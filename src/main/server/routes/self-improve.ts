import { Router } from 'express'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname, normalize, relative } from 'path'
import { app } from 'electron'

export const selfImproveRouter = Router()

function getProjectRoot(): string {
  return join(app.getAppPath(), '..')
}

function isPathSafe(targetPath: string): boolean {
  const root = normalize(getProjectRoot())
  const target = normalize(targetPath)
  const rel = relative(root, target)
  return !rel.startsWith('..') && !rel.startsWith('.git') && !rel.startsWith('node_modules') && !rel.startsWith('out')
}

selfImproveRouter.post('/apply', async (req, res) => {
  const { edits } = req.body as { edits: Array<{ path: string; content: string }> }

  if (!edits || !Array.isArray(edits) || edits.length === 0) {
    res.status(400).json({ error: 'No edits provided' })
    return
  }

  const root = getProjectRoot()
  const results: Array<{ path: string; status: 'written' | 'error'; error?: string }> = []

  for (const edit of edits) {
    const fullPath = join(root, edit.path)
    if (!isPathSafe(fullPath)) {
      results.push({ path: edit.path, status: 'error', error: 'Path is outside project root or in a protected directory' })
      continue
    }
    try {
      mkdirSync(dirname(fullPath), { recursive: true })
      writeFileSync(fullPath, edit.content, 'utf-8')
      results.push({ path: edit.path, status: 'written' })
    } catch (err: any) {
      results.push({ path: edit.path, status: 'error', error: err.message })
    }
  }

  const allOk = results.every((r) => r.status === 'written')
  res.json({ success: allOk, results })
})
