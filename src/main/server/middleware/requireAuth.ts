import type { Request, Response, NextFunction } from 'express'
import 'express-session'

declare module 'express-session' {
  interface SessionData {
    userId?: string
  }
}

export interface AuthedRequest extends Request {
  userId?: string
}

/** Web (multi-tenant) mode: requires a logged-in session. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const userId = req.session?.userId
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  req.userId = userId
  next()
}

/** Desktop (Electron) mode: there is only ever one local user, no login required. */
export function localUser(fixedUserId: string) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    req.userId = fixedUserId
    next()
  }
}
