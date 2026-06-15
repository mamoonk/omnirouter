import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { routeRequest } from '../services/router'
import { createConversation, getConversations, getMessages, saveMessage, deleteConversation, deleteAllConversations, deleteConversationsByIds } from '../db/index'
import { getSetting } from '../db/index'
import { buildSystemPrompt } from '../services/codebase'
import { getTreeNodes, buildProjectSystemPrompt } from '../services/projectAgent'
import type { ActivityStep, Attachment, DebateData, RoutingStrategy, SSEMessage } from '@shared/types'
import { runDebate } from '../services/debate'

export const chatRouter = Router()

chatRouter.post('/stream', async (req, res) => {
  const { conversationId, content, selfImprove, debate, attachments, projectId, codeProjectRoot } = req.body

  if (!content && (!attachments || attachments.length === 0)) {
    res.status(400).json({ error: 'Content or attachments is required' })
    return
  }

  const cid = conversationId || uuid()

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })

  const sendStep = (step: ActivityStep): void => {
    res.write(`data: ${JSON.stringify({ type: 'step', data: step } as SSEMessage)}\n\n`)
  }

  const cacheEnabled = getSetting('cacheEnabled') !== 'false'
  const compressionEnabled = getSetting('compressionEnabled') !== 'false'
  const tokenOptimization = getSetting('tokenOptimization') !== 'false'
  const tokenOptimizationThreshold = parseInt(getSetting('tokenOptimizationThreshold') || '70', 10)
  const routingStrategy = (getSetting('routingStrategy') || 'smart') as RoutingStrategy
  const routeOptions = { cacheEnabled, compressionEnabled, tokenOptimization, tokenOptimizationThreshold, preferCode: selfImprove, routingStrategy, onStep: sendStep }

  try {
    const msgs = conversationId
      ? (await getMessages(conversationId)).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
      : []

    if (selfImprove) {
      if (codeProjectRoot) {
        sendStep({ id: 'agent-read', kind: 'tool', label: 'Reading project', detail: `Scanning ${codeProjectRoot}`, status: 'running' })
        const nodes = getTreeNodes(codeProjectRoot)
        const systemContent = buildProjectSystemPrompt(content, codeProjectRoot, nodes)
        sendStep({ id: 'agent-read', kind: 'tool', label: 'Read project', detail: 'Loaded file tree and relevant files', status: 'done' })
        msgs.unshift({ role: 'system' as const, content: systemContent })
      } else {
        sendStep({ id: 'agent-read', kind: 'tool', label: 'Reading project source', detail: 'Scanning the app codebase for relevant files', status: 'running' })
        const systemContent = buildSystemPrompt(content)
        sendStep({ id: 'agent-read', kind: 'tool', label: 'Read project source', detail: 'Loaded the file tree and relevant files into context', status: 'done' })
        msgs.unshift({ role: 'system' as const, content: systemContent })
      }
    }

    const debateRounds = parseInt(getSetting('debateRounds') || '1', 10)

    const userAttachments = attachments as Attachment[] | undefined

    if (debate) {
      msgs.push({ role: 'user' as const, content, attachments: userAttachments })

      {
        const title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
        createConversation(cid, title, projectId)
      }
      saveMessage(cid, 'user', content, undefined, undefined, undefined, undefined, undefined, undefined, JSON.stringify(attachments || []))

      try {
        const debateData = await runDebate(msgs, debateRounds, sendStep)

        const finalAnswer = debateData.rounds[debateData.rounds.length - 1]?.content || ''
        const allErrors = debateData.rounds.every((r) => r.content.startsWith('['))

        if (allErrors) {
          const result = await routeRequest(msgs, routeOptions)
          const rc = result.response
          for (const word of rc.content.split(/(\s+)/)) {
            res.write(`data: ${JSON.stringify({ type: 'token', data: word, provider: result.provider, model: result.model } as SSEMessage)}\n\n`)
          }
          const doneMsg: SSEMessage = { type: 'done', data: JSON.stringify(rc) }
          res.write(`data: ${JSON.stringify(doneMsg)}\n\n`)
          saveMessage(cid, 'assistant', rc.content, result.provider, result.model, rc.tokensIn, rc.tokensOut)
          res.end()
          return
        }

        const debateMsg: SSEMessage = {
          type: 'debate',
          data: debateData
        }
        res.write(`data: ${JSON.stringify(debateMsg)}\n\n`)

        saveMessage(cid, 'assistant', finalAnswer, debateData.rounds[0]?.provider, debateData.rounds[0]?.model)
      } catch (err: any) {
        const result = await routeRequest(msgs, routeOptions)
        const rc = result.response
        for (const word of rc.content.split(/(\s+)/)) {
          res.write(`data: ${JSON.stringify({ type: 'token', data: word, provider: result.provider, model: result.model } as SSEMessage)}\n\n`)
        }
        const doneMsg: SSEMessage = { type: 'done', data: JSON.stringify(rc) }
        res.write(`data: ${JSON.stringify(doneMsg)}\n\n`)
        saveMessage(cid, 'assistant', rc.content, result.provider, result.model, rc.tokensIn, rc.tokensOut)
      }

      res.end()
      return
    }

    msgs.push({ role: 'user' as const, content, attachments: userAttachments })

    {
      const title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
      createConversation(cid, title, projectId)
    }
    saveMessage(cid, 'user', content, undefined, undefined, undefined, undefined, undefined, undefined, JSON.stringify(attachments || []))

    const result = await routeRequest(msgs, routeOptions)
    const rc = result.response
    const contentText = rc.content

    if (rc.imageData || rc.imageUrl) {
      const doneMsg: SSEMessage = {
        type: 'done',
        data: JSON.stringify(rc)
      }
      res.write(`data: ${JSON.stringify(doneMsg)}\n\n`)
      saveMessage(cid, 'assistant', contentText, result.provider, result.model, rc.tokensIn, rc.tokensOut, rc.imageUrl, rc.imageData)
      res.end()
      return
    }

    for (const word of contentText.split(/(\s+)/)) {
      const tokenMsg: SSEMessage = {
        type: 'token',
        data: word,
        provider: result.provider,
        model: result.model
      }
      res.write(`data: ${JSON.stringify(tokenMsg)}\n\n`)
    }

    saveMessage(cid, 'assistant', contentText, result.provider, result.model, rc.tokensIn, rc.tokensOut)

    const doneMsg: SSEMessage = { type: 'done', data: JSON.stringify(rc) }
    res.write(`data: ${JSON.stringify(doneMsg)}\n\n`)
  } catch (err: any) {
    const errorMsg: SSEMessage = {
      type: 'error',
      data: err.message || 'Internal server error'
    }
    res.write(`data: ${JSON.stringify(errorMsg)}\n\n`)
  }

  res.end()
})

chatRouter.get('/conversations', async (req, res) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined
    const conversations = getConversations(projectId)
    res.json(conversations)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

chatRouter.delete('/conversations', async (req, res) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined
    deleteAllConversations(projectId)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

chatRouter.post('/conversations/delete', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: unknown) => typeof x === 'string') : []
    deleteConversationsByIds(ids)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

chatRouter.get('/conversations/:id/messages', async (req, res) => {
  try {
    const messages = getMessages(req.params.id)
    res.json(messages)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

chatRouter.delete('/conversations/:id', async (req, res) => {
  try {
    deleteConversation(req.params.id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
