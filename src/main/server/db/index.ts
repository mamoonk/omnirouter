import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database

const SCHEMA = `
CREATE TABLE IF NOT EXISTS quota_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  window_minute TEXT NOT NULL,
  window_day TEXT NOT NULL,
  UNIQUE(provider, window_minute)
);

CREATE TABLE IF NOT EXISTS response_cache (
  prompt_hash TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  project_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  image_url TEXT,
  image_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quota_log_provider ON quota_log(provider);
CREATE INDEX IF NOT EXISTS idx_quota_log_window ON quota_log(window_minute, window_day);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON response_cache(expires_at);
`

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export async function initDatabase(): Promise<void> {
  const dbPath = join(app.getPath('userData'), 'myrouter.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  try { db.exec('ALTER TABLE messages ADD COLUMN image_url TEXT') } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN image_data TEXT') } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN attachments TEXT') } catch {}
  try { db.exec('ALTER TABLE conversations ADD COLUMN project_id TEXT') } catch {}

  // Every chat belongs to a project: ensure a catch-all "Default" project exists
  // and adopt any previously unfiled conversations into it.
  db.prepare("INSERT OR IGNORE INTO projects (id, name) VALUES ('default', 'Default')").run()
  db.prepare("UPDATE conversations SET project_id = 'default' WHERE project_id IS NULL OR project_id = ''").run()
}

export const DEFAULT_PROJECT_ID = 'default'

export function createProject(id: string, name: string): void {
  getDb().prepare('INSERT INTO projects (id, name) VALUES (?, ?)').run(id, name)
}

export function getProjects(): Array<{ id: string; name: string; conversationCount: number; createdAt: string }> {
  return getDb().prepare(
    `SELECT p.id, p.name, p.created_at as createdAt,
       (SELECT COUNT(*) FROM conversations c WHERE c.project_id = p.id) as conversationCount
     FROM projects p ORDER BY (p.id = 'default') DESC, p.created_at ASC`
  ).all() as any
}

export function renameProject(id: string, name: string): void {
  if (id === DEFAULT_PROJECT_ID) return
  getDb().prepare('UPDATE projects SET name = ? WHERE id = ?').run(name, id)
}

export function deleteProject(id: string): void {
  if (id === DEFAULT_PROJECT_ID) return // the catch-all project cannot be deleted
  const d = getDb()
  // Conversations (and their messages, via cascade) belonging to the project go too.
  d.prepare('DELETE FROM conversations WHERE project_id = ?').run(id)
  d.prepare('DELETE FROM projects WHERE id = ?').run(id)
}

export function saveQuotaLog(
  provider: string,
  requests: number,
  tokensIn: number,
  tokensOut: number,
  windowMinute: string,
  windowDay: string
): void {
  const d = getDb()
  const stmt = d.prepare(`
    INSERT INTO quota_log (provider, requests, tokens_in, tokens_out, window_minute, window_day)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider, window_minute) DO UPDATE SET
      requests = requests + excluded.requests,
      tokens_in = tokens_in + excluded.tokens_in,
      tokens_out = tokens_out + excluded.tokens_out
  `)
  stmt.run(provider, requests, tokensIn, tokensOut, windowMinute, windowDay)
}

export function getQuotaForProvider(provider: string): {
  minuteRequests: number
  minuteTokens: number
  dayTokensIn: number
} {
  const d = getDb()
  const now = new Date()
  const minuteKey = now.toISOString().slice(0, 16) + ':00Z'
  const dayKey = now.toISOString().slice(0, 10)

  const minuteRow = d.prepare(
    `SELECT COALESCE(SUM(requests),0) as req, COALESCE(SUM(tokens_in + tokens_out),0) as tok
     FROM quota_log WHERE provider = ? AND window_minute = ?`
  ).get(provider, minuteKey) as { req: number; tok: number }

  const dayRow = d.prepare(
    `SELECT COALESCE(SUM(tokens_in),0) as tok
     FROM quota_log WHERE provider = ? AND window_day = ?`
  ).get(provider, dayKey) as { req?: number; tok: number }

  return {
    minuteRequests: minuteRow.req,
    minuteTokens: minuteRow.tok,
    dayTokensIn: dayRow.tok
  }
}

export function getCacheEntry(promptHash: string): {
  response: string
  provider: string
  model: string
  tokensIn: number
  tokensOut: number
} | null {
  const d = getDb()
  const row = d.prepare(
    `SELECT response, provider, model, tokens_in, tokens_out
     FROM response_cache
     WHERE prompt_hash = ? AND expires_at > datetime('now')`
  ).get(promptHash) as any
  return row ? { response: row.response, provider: row.provider, model: row.model, tokensIn: row.tokens_in, tokensOut: row.tokens_out } : null
}

export function setCacheEntry(
  promptHash: string,
  prompt: string,
  response: string,
  provider: string,
  model: string,
  tokensIn: number,
  tokensOut: number
): void {
  const d = getDb()
  const stmt = d.prepare(`
    INSERT OR REPLACE INTO response_cache (prompt_hash, prompt, response, provider, model, tokens_in, tokens_out, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+1 day'))
  `)
  stmt.run(promptHash, prompt, response, provider, model, tokensIn, tokensOut)
}

export function createConversation(id: string, title: string, projectId?: string | null): void {
  const d = getDb()
  d.prepare('INSERT OR IGNORE INTO conversations (id, title, project_id) VALUES (?, ?, ?)').run(id, title, projectId || DEFAULT_PROJECT_ID)
}

export function getConversations(projectId?: string | null): Array<{ id: string; title: string; projectId: string | null; updatedAt: string }> {
  const d = getDb()
  if (projectId) {
    return d.prepare(
      'SELECT id, title, project_id as projectId, updated_at as updatedAt FROM conversations WHERE project_id = ? ORDER BY updated_at DESC'
    ).all(projectId) as any
  }
  return d.prepare(
    'SELECT id, title, project_id as projectId, updated_at as updatedAt FROM conversations ORDER BY updated_at DESC'
  ).all() as any
}

export function deleteConversation(id: string): void {
  const d = getDb()
  d.prepare('DELETE FROM conversations WHERE id = ?').run(id)
}

export function deleteConversationsByIds(ids: string[]): void {
  if (ids.length === 0) return
  const d = getDb()
  const placeholders = ids.map(() => '?').join(',')
  d.prepare(`DELETE FROM conversations WHERE id IN (${placeholders})`).run(...ids)
}

export function deleteAllConversations(projectId?: string | null): void {
  const d = getDb()
  if (projectId) {
    d.prepare('DELETE FROM conversations WHERE project_id = ?').run(projectId)
  } else {
    d.prepare('DELETE FROM conversations').run()
  }
}

export function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  provider?: string,
  model?: string,
  tokensIn?: number,
  tokensOut?: number,
  imageUrl?: string,
  imageData?: string,
  attachments?: string
): number {
  const d = getDb()
  const stmt = d.prepare(`
    INSERT INTO messages (conversation_id, role, content, provider, model, tokens_in, tokens_out, image_url, image_data, attachments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(conversationId, role, content, provider || null, model || null, tokensIn || null, tokensOut || null, imageUrl || null, imageData || null, attachments || null)
  d.prepare('UPDATE conversations SET updated_at = datetime(\'now\') WHERE id = ?').run(conversationId)
  return Number(result.lastInsertRowid)
}

export function getMessages(conversationId: string): Array<{
  id: number
  role: string
  content: string
  provider: string | null
  model: string | null
  tokensIn: number | null
  tokensOut: number | null
  imageUrl: string | null
  imageData: string | null
  attachments: string | null
  createdAt: string
}> {
  const d = getDb()
  return d.prepare(
    `SELECT id, role, content, provider, model, tokens_in as tokensIn, tokens_out as tokensOut, image_url as imageUrl, image_data as imageData, attachments, created_at as createdAt
     FROM messages WHERE conversation_id = ? ORDER BY id ASC`
  ).all(conversationId) as any
}

export function getSetting(key: string): string | null {
  const d = getDb()
  const row = d.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row ? row.value : null
}

export function setSetting(key: string, value: string): void {
  const d = getDb()
  d.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}
