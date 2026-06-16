import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { routeRequest } from '../services/router'
import { createConversation, getConversations, getMessages, saveMessage, deleteConversation, deleteAllConversations, deleteConversationsByIds, conversationBelongsToUser, conversationExists } from '../db/index'
import { getSetting } from '../db/index'
import { buildSystemPrompt } from '../services/codebase'
import { getTreeNodes, buildProjectSystemPrompt } from '../services/projectAgent'
import type { ActivityStep, Attachment, DebateData, RoutingStrategy, SSEMessage } from '@shared/types'
import { runDebate } from '../services/debate'
import type { AuthedRequest } from '../middleware/requireAuth'
import { LOCAL_USER_ID } from '../db/index'

export const chatRouter = Router()

chatRouter.post('/stream', async (req: AuthedRequest, res) => {
  const userId = req.userId!
  // Agent-mode/self-improve reads and writes files on the local machine via
  // Electron IPC and the /api/self-improve and /api/code routes — those routes
  // aren't mounted outside the desktop ('local') flow, so ignore the flags here too.
  const isLocal = userId === LOCAL_USER_ID
  const { conversationId, content, debate, attachments, projectId, agentMode } = req.body
  const selfImprove = isLocal && req.body.selfImprove
  const codeProjectRoot = isLocal ? req.body.codeProjectRoot : undefined

  // Only block on conversations that already exist under a *different* user — a brand
  // new conversation's id is generated client-side and won't exist in the DB yet,
  // since createConversation() below is what actually creates the row.
  if (conversationId && conversationExists(conversationId) && !conversationBelongsToUser(userId, conversationId)) {
    res.status(403).json({ error: 'Conversation does not belong to this user' })
    return
  }

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

  const cacheEnabled = getSetting(userId, 'cacheEnabled') !== 'false'
  const compressionEnabled = getSetting(userId, 'compressionEnabled') !== 'false'
  const tokenOptimization = getSetting(userId, 'tokenOptimization') !== 'false'
  const tokenOptimizationThreshold = parseInt(getSetting(userId, 'tokenOptimizationThreshold') || '70', 10)
  const routingStrategy = (getSetting(userId, 'routingStrategy') || 'smart') as RoutingStrategy
  const routeOptions = { userId, cacheEnabled, compressionEnabled, tokenOptimization, tokenOptimizationThreshold, preferCode: selfImprove, routingStrategy, onStep: sendStep }

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
        const systemContent = buildProjectSystemPrompt(content, codeProjectRoot, nodes, agentMode || 'generate')
        sendStep({ id: 'agent-read', kind: 'tool', label: 'Read project', detail: 'Loaded file tree and relevant files', status: 'done' })
        msgs.unshift({ role: 'system' as const, content: systemContent })
      } else {
        sendStep({ id: 'agent-read', kind: 'tool', label: 'Reading project source', detail: 'Scanning the app codebase for relevant files', status: 'running' })
        const systemContent = buildSystemPrompt(content, agentMode || 'generate')
        sendStep({ id: 'agent-read', kind: 'tool', label: 'Read project source', detail: 'Loaded the file tree and relevant files into context', status: 'done' })
        msgs.unshift({ role: 'system' as const, content: systemContent })
      }
    }

    const debateRounds = parseInt(getSetting(userId, 'debateRounds') || '1', 10)

    const userAttachments = attachments as Attachment[] | undefined

    if (debate) {
      msgs.push({ role: 'user' as const, content, attachments: userAttachments })

      {
        const title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
        createConversation(userId, cid, title, projectId)
      }
      saveMessage(cid, 'user', content, undefined, undefined, undefined, undefined, undefined, undefined, JSON.stringify(attachments || []))

      try {
        const debateData = await runDebate(userId, msgs, debateRounds, sendStep)

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
      createConversation(userId, cid, title, projectId)
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

chatRouter.get('/conversations', async (req: AuthedRequest, res) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined
    const conversations = getConversations(req.userId!, projectId)
    res.json(conversations)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

chatRouter.delete('/conversations', async (req: AuthedRequest, res) => {
  try {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined
    deleteAllConversations(req.userId!, projectId)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

chatRouter.post('/conversations/delete', async (req: AuthedRequest, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: unknown) => typeof x === 'string') : []
    deleteConversationsByIds(req.userId!, ids)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

chatRouter.get('/conversations/:id/messages', async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id)
    if (!conversationBelongsToUser(req.userId!, id)) {
      res.status(403).json({ error: 'Conversation does not belong to this user' })
      return
    }
    const messages = getMessages(id)
    res.json(messages)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

chatRouter.delete('/conversations/:id', async (req: AuthedRequest, res) => {
  try {
    deleteConversation(req.userId!, String(req.params.id))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
