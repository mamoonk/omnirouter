import express, { type Express } from 'express'
import cors from 'cors'
import session from 'express-session'
import { loadEnv } from './services/envManager'
import { chatRouter } from './routes/chat'
import { projectsRouter } from './routes/projects'
import { quotaRouter } from './routes/quota'
import { dashboardRouter } from './routes/dashboard'
import { settingsRouter } from './routes/settings'
import { statusRouter } from './routes/status'
import { selfImproveRouter } from './routes/self-improve'
import { codeRouter } from './routes/code'
import { authRouter } from './routes/auth'
import { requireAuth, localUser } from './middleware/requireAuth'
import { LOCAL_USER_ID } from './db/index'

export interface CreateAppOptions {
  /**
   * 'local' — single-user Electron desktop flow: every request is implicitly the
   *           one local user, no login, and the Code/agent-mode routes are mounted.
   * 'web'   — multi-tenant browser flow: requires a session cookie from /api/auth/*,
   *           and the local-filesystem Code/agent-mode routes are not exposed.
   */
  mode: 'local' | 'web'
  /** Required in 'web' mode — secret used to sign the session cookie. */
  sessionSecret?: string
}

export function createApp(options: CreateAppOptions): Express {
  const app = express()
  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json({ limit: '50mb' }))

  if (options.mode === 'web') {
    app.use(session({
      secret: options.sessionSecret || 'myrouter-dev-session-secret-change-me',
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 }
    }))
    app.use('/api/auth', authRouter)
    app.use('/api/chat', requireAuth, chatRouter)
    app.use('/api/projects', requireAuth, projectsRouter)
    app.use('/api/quota', requireAuth, quotaRouter)
    app.use('/api/dashboard', requireAuth, dashboardRouter)
    app.use('/api/settings', requireAuth, settingsRouter)
    app.use('/api/status', requireAuth, statusRouter)
    // Code/agent-mode and self-improve touch the server's local filesystem —
    // not exposed in multi-tenant web mode.
  } else {
    const local = localUser(LOCAL_USER_ID)
    app.use('/api/chat', local, chatRouter)
    app.use('/api/projects', local, projectsRouter)
    app.use('/api/quota', local, quotaRouter)
    app.use('/api/dashboard', local, dashboardRouter)
    app.use('/api/settings', local, settingsRouter)
    app.use('/api/status', local, statusRouter)
    app.use('/api/self-improve', selfImproveRouter)
    app.use('/api/code', codeRouter)
  }

  return app
}

/** Desktop (Electron) entry point: single local user, OS-assigned port. */
export async function startServer(): Promise<number> {
  loadEnv()
  const app = createApp({ mode: 'local' })

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 3456
      console.log(`Server running on port ${port}`)
      resolve(port)
    })
  })
}
