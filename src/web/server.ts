import express from 'express'
import { join, dirname } from 'path'
import { mkdirSync } from 'fs'
import { createApp } from '../main/server/index'
import { initDatabase } from '../main/server/db/index'

async function main() {
  const dbPath = process.env.MYROUTER_DB_PATH || join(process.cwd(), 'data', 'myrouter.db')
  mkdirSync(dirname(dbPath), { recursive: true })
  await initDatabase(dbPath)

  const app = createApp({ mode: 'web', sessionSecret: process.env.MYROUTER_SECRET })

  // Serve electron-vite's renderer build output (out/renderer) as a static site,
  // same-origin with the /api/* routes mounted by createApp — one process, one
  // port, no CORS/port-discovery needed in the browser. Resolved from cwd (not
  // __dirname) since this file runs directly via tsx, not from a compiled out/ dir.
  const rendererDist = process.env.MYROUTER_RENDERER_DIST || join(process.cwd(), 'out', 'renderer')
  app.use(express.static(rendererDist))
  app.get('*', (_req, res) => {
    res.sendFile(join(rendererDist, 'index.html'))
  })

  const port = parseInt(process.env.PORT || '3000', 10)
  app.listen(port, () => {
    console.log(`myrouter web server listening on port ${port}`)
  })
}

main().catch((err) => {
  console.error('Failed to start web server:', err)
  process.exit(1)
})
