import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { createProject, getProjects, renameProject, deleteProject } from '../db/index'
import type { AuthedRequest } from '../middleware/requireAuth'

export const projectsRouter = Router()

projectsRouter.get('/', (req: AuthedRequest, res) => {
  try {
    res.json(getProjects(req.userId!))
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

projectsRouter.post('/', (req: AuthedRequest, res) => {
  try {
    const name = (req.body?.name || '').trim() || 'New Project'
    const id = uuid()
    createProject(req.userId!, id, name)
    res.json({ id, name })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

projectsRouter.patch('/:id', (req: AuthedRequest, res) => {
  try {
    const name = (req.body?.name || '').trim()
    if (!name) {
      res.status(400).json({ error: 'Name is required' })
      return
    }
    renameProject(req.userId!, String(req.params.id), name)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

projectsRouter.delete('/:id', (req: AuthedRequest, res) => {
  try {
    deleteProject(req.userId!, String(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
