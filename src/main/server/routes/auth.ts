import { Router } from 'express'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { createUser, getUserByEmail, getUserById } from '../db/index'

export const authRouter = Router()

authRouter.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email || !password || password.length < 8) {
      res.status(400).json({ error: 'Email and a password of at least 8 characters are required' })
      return
    }
    if (getUserByEmail(email)) {
      res.status(409).json({ error: 'An account with that email already exists' })
      return
    }

    const id = randomUUID()
    const passwordHash = await bcrypt.hash(password, 12)
    createUser(id, email, passwordHash)

    req.session.userId = id
    res.json({ id, email })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string }
    const user = email ? getUserByEmail(email) : null
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    req.session.userId = user.id
    res.json({ id: user.id, email: user.email })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

authRouter.get('/me', (req, res) => {
  const userId = req.session.userId
  const user = userId ? getUserById(userId) : null
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  res.json(user)
})
