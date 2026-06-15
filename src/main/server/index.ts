import express from 'express'
import cors from 'cors'
import { loadEnv } from './services/envManager'
import { chatRouter } from './routes/chat'
import { projectsRouter } from './routes/projects'
import { quotaRouter } from './routes/quota'
import { dashboardRouter } from './routes/dashboard'
import { settingsRouter } from './routes/settings'
import { statusRouter } from './routes/status'
import { selfImproveRouter } from './routes/self-improve'
import { codeRouter } from './routes/code'

export async function startServer(): Promise<number> {
  loadEnv()

  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '50mb' }))

  app.use('/api/chat', chatRouter)
  app.use('/api/projects', projectsRouter)
  app.use('/api/quota', quotaRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/status', statusRouter)
  app.use('/api/self-improve', selfImproveRouter)
  app.use('/api/code', codeRouter)

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 3456
      console.log(`Server running on port ${port}`)
      resolve(port)
    })
  })
}
