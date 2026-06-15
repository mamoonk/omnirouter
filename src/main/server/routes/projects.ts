import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { createProject, getProjects, renameProject, deleteProject } from '../db/index'

export const projectsRouter = Router()

projectsRouter.get('/', (_req, res) => {
  try {
    res.json(getProjects())
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

projectsRouter.post('/', (req, res) => {
  try {
    const name = (req.body?.name || '').trim() || 'New Project'
    const id = uuid()
    createProject(id, name)
    res.json({ id, name })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

projectsRouter.patch('/:id', (req, res) => {
  try {
    const name = (req.body?.name || '').trim()
    if (!name) {
      res.status(400).json({ error: 'Name is required' })
      return
    }
    renameProject(req.params.id, name)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

projectsRouter.delete('/:id', (req, res) => {
  try {
    deleteProject(req.params.id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
