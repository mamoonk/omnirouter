import Database from 'better-sqlite3'
import { join } from 'path'

let db: Database.Database
let dbPath: string

export const LOCAL_USER_ID = 'local'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS quota_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL DEFAULT 'local',
  provider TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  window_minute TEXT NOT NULL,
  window_day TEXT NOT NULL,
  UNIQUE(user_id, provider, window_minute)
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
  user_id TEXT NOT NULL DEFAULT 'local',
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local',
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
  user_id TEXT NOT NULL DEFAULT 'local',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
`

// Indexes reference `user_id` columns that may not exist yet on a database created
// before this column was added — they must run after the ALTER TABLE migrations
// below, not as part of the initial CREATE TABLE batch.
const INDEXES = `
CREATE INDEX IF NOT EXISTS idx_quota_log_provider ON quota_log(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_quota_log_window ON quota_log(window_minute, window_day);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON response_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
`

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

/**
 * Rebuilds `table` under `createSql` if its existing constraint doesn't already
 * contain `expectedConstraintFragment` — i.e. it predates a constraint change that
 * ALTER TABLE can't apply retroactively. No-op for fresh databases (constraint
 * already matches) and safe to run on every startup.
 */
function rebuildTableIfConstraintStale(
  table: string,
  expectedConstraintFragment: string,
  createSql: string,
  copyColumns: string
): void {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table) as { sql: string } | undefined
  if (!row || row.sql.includes(expectedConstraintFragment)) return

  const legacyTable = `${table}_legacy`
  db.exec(`ALTER TABLE ${table} RENAME TO ${legacyTable}`)
  db.exec(createSql)
  db.exec(`INSERT INTO ${table} (${copyColumns}) SELECT ${copyColumns} FROM ${legacyTable}`)
  db.exec(`DROP TABLE ${legacyTable}`)
}

/**
 * `path` lets callers (Electron main process vs. the standalone web server)
 * supply their own DB file location instead of this module reaching into
 * platform-specific APIs itself.
 */
export async function initDatabase(path: string): Promise<void> {
  dbPath = path
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  try { db.exec('ALTER TABLE messages ADD COLUMN image_url TEXT') } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN image_data TEXT') } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN attachments TEXT') } catch {}
  try { db.exec('ALTER TABLE conversations ADD COLUMN project_id TEXT') } catch {}
  try { db.exec("ALTER TABLE projects ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'") } catch {}
  try { db.exec("ALTER TABLE conversations ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'") } catch {}
  try { db.exec("ALTER TABLE quota_log ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'") } catch {}
  try { db.exec("ALTER TABLE settings ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local'") } catch {}

  // SQLite can't ALTER a UNIQUE/PRIMARY KEY constraint — a database created before the
  // user_id column existed still has the old single-column constraint even after the
  // ALTER TABLE above adds the column, so ON CONFLICT(user_id, ...) silently fails to
  // match anything. Rebuild these two tables under the new composite constraint.
  rebuildTableIfConstraintStale(
    'quota_log',
    'UNIQUE(user_id, provider, window_minute)',
    `CREATE TABLE quota_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'local',
      provider TEXT NOT NULL,
      requests INTEGER NOT NULL DEFAULT 0,
      tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0,
      window_minute TEXT NOT NULL,
      window_day TEXT NOT NULL,
      UNIQUE(user_id, provider, window_minute)
    )`,
    'user_id, provider, requests, tokens_in, tokens_out, window_minute, window_day'
  )
  rebuildTableIfConstraintStale(
    'settings',
    'PRIMARY KEY (user_id, key)',
    `CREATE TABLE settings (
      user_id TEXT NOT NULL DEFAULT 'local',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    )`,
    'user_id, key, value'
  )

  db.exec(INDEXES)

  // Every chat belongs to a project: ensure a catch-all "Default" project exists
  // for the local (desktop) user and adopt any previously unfiled conversations into it.
  db.prepare("INSERT OR IGNORE INTO projects (id, user_id, name) VALUES ('default', 'local', 'Default')").run()
  db.prepare("UPDATE conversations SET project_id = 'default' WHERE project_id IS NULL OR project_id = ''").run()
}

export const DEFAULT_PROJECT_ID = 'default'

export function createUser(id: string, email: string, passwordHash: string): void {
  getDb().prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, email, passwordHash)
  getDb().prepare("INSERT OR IGNORE INTO projects (id, user_id, name) VALUES (?, ?, 'Default')").run(`default-${id}`, id)
}

export function getUserByEmail(email: string): { id: string; email: string; passwordHash: string } | null {
  const row = getDb().prepare('SELECT id, email, password_hash as passwordHash FROM users WHERE email = ?').get(email) as any
  return row || null
}

export function getUserById(id: string): { id: string; email: string } | null {
  const row = getDb().prepare('SELECT id, email FROM users WHERE id = ?').get(id) as any
  return row || null
}

/** Per-user default project id — the desktop/local user keeps using the legacy 'default' id. */
export function defaultProjectIdFor(userId: string): string {
  return userId === LOCAL_USER_ID ? DEFAULT_PROJECT_ID : `default-${userId}`
}

export function createProject(userId: string, id: string, name: string): void {
  getDb().prepare('INSERT INTO projects (id, user_id, name) VALUES (?, ?, ?)').run(id, userId, name)
}

export function getProjects(userId: string): Array<{ id: string; name: string; conversationCount: number; createdAt: string }> {
  return getDb().prepare(
    `SELECT p.id, p.name, p.created_at as createdAt,
       (SELECT COUNT(*) FROM conversations c WHERE c.project_id = p.id) as conversationCount
     FROM projects p WHERE p.user_id = ? ORDER BY (p.id = ?) DESC, p.created_at ASC`
  ).all(userId, defaultProjectIdFor(userId)) as any
}

export function renameProject(userId: string, id: string, name: string): void {
  if (id === defaultProjectIdFor(userId)) return
  getDb().prepare('UPDATE projects SET name = ? WHERE id = ? AND user_id = ?').run(name, id, userId)
}

export function deleteProject(userId: string, id: string): void {
  if (id === defaultProjectIdFor(userId)) return // the catch-all project cannot be deleted
  const d = getDb()
  // Conversations (and their messages, via cascade) belonging to the project go too.
  d.prepare('DELETE FROM conversations WHERE project_id = ? AND user_id = ?').run(id, userId)
  d.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(id, userId)
}

export function saveQuotaLog(
  userId: string,
  provider: string,
  requests: number,
  tokensIn: number,
  tokensOut: number,
  windowMinute: string,
  windowDay: string
): void {
  const d = getDb()
  const stmt = d.prepare(`
    INSERT INTO quota_log (user_id, provider, requests, tokens_in, tokens_out, window_minute, window_day)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, provider, window_minute) DO UPDATE SET
      requests = requests + excluded.requests,
      tokens_in = tokens_in + excluded.tokens_in,
      tokens_out = tokens_out + excluded.tokens_out
  `)
  stmt.run(userId, provider, requests, tokensIn, tokensOut, windowMinute, windowDay)
}

export function getQuotaForProvider(userId: string, provider: string): {
  minuteRequests: number
  minuteTokens: number
  dayTokensIn: number
  dayRequests: number
} {
  const d = getDb()
  const now = new Date()
  const minuteKey = now.toISOString().slice(0, 16) + ':00Z'
  const dayKey = now.toISOString().slice(0, 10)

  const minuteRow = d.prepare(
    `SELECT COALESCE(SUM(requests),0) as req, COALESCE(SUM(tokens_in + tokens_out),0) as tok
     FROM quota_log WHERE user_id = ? AND provider = ? AND window_minute = ?`
  ).get(userId, provider, minuteKey) as { req: number; tok: number }

  const dayRow = d.prepare(
    `SELECT COALESCE(SUM(tokens_in),0) as tok, COALESCE(SUM(requests),0) as req
     FROM quota_log WHERE user_id = ? AND provider = ? AND window_day = ?`
  ).get(userId, provider, dayKey) as { req: number; tok: number }

  return {
    minuteRequests: minuteRow.req,
    minuteTokens: minuteRow.tok,
    dayTokensIn: dayRow.tok,
    dayRequests: dayRow.req
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

export function createConversation(userId: string, id: string, title: string, projectId?: string | null): void {
  const d = getDb()
  d.prepare('INSERT OR IGNORE INTO conversations (id, user_id, title, project_id) VALUES (?, ?, ?, ?)').run(id, userId, title, projectId || defaultProjectIdFor(userId))
}

export function getConversations(userId: string, projectId?: string | null): Array<{ id: string; title: string; projectId: string | null; updatedAt: string }> {
  const d = getDb()
  if (projectId) {
    return d.prepare(
      'SELECT id, title, project_id as projectId, updated_at as updatedAt FROM conversations WHERE user_id = ? AND project_id = ? ORDER BY updated_at DESC'
    ).all(userId, projectId) as any
  }
  return d.prepare(
    'SELECT id, title, project_id as projectId, updated_at as updatedAt FROM conversations WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(userId) as any
}

export function deleteConversation(userId: string, id: string): void {
  const d = getDb()
  d.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').run(id, userId)
}

export function deleteConversationsByIds(userId: string, ids: string[]): void {
  if (ids.length === 0) return
  const d = getDb()
  const placeholders = ids.map(() => '?').join(',')
  d.prepare(`DELETE FROM conversations WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, userId)
}

export function deleteAllConversations(userId: string, projectId?: string | null): void {
  const d = getDb()
  if (projectId) {
    d.prepare('DELETE FROM conversations WHERE user_id = ? AND project_id = ?').run(userId, projectId)
  } else {
    d.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId)
  }
}

/** Verifies the conversation belongs to the user before any message read/write. */
export function conversationBelongsToUser(userId: string, conversationId: string): boolean {
  const row = getDb().prepare('SELECT 1 FROM conversations WHERE id = ? AND user_id = ?').get(conversationId, userId)
  return !!row
}

/** True if any row exists for this id, regardless of owner — distinguishes "new chat" from "someone else's chat". */
export function conversationExists(conversationId: string): boolean {
  const row = getDb().prepare('SELECT 1 FROM conversations WHERE id = ?').get(conversationId)
  return !!row
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

export function getSetting(userId: string, key: string): string | null {
  const d = getDb()
  const row = d.prepare('SELECT value FROM settings WHERE user_id = ? AND key = ?').get(userId, key) as { value: string } | undefined
  return row ? row.value : null
}

export function setSetting(userId: string, key: string, value: string): void {
  const d = getDb()
  d.prepare('INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)').run(userId, key, value)
}

export function getApiKeyStatus(userId: string): Record<string, boolean> {
  const rows = getDb().prepare('SELECT provider FROM api_keys WHERE user_id = ?').all(userId) as Array<{ provider: string }>
  const status: Record<string, boolean> = {}
  for (const row of rows) status[row.provider] = true
  return status
}

export function setUserApiKey(userId: string, provider: string, encryptedKey: string): void {
  getDb().prepare(
    'INSERT INTO api_keys (user_id, provider, encrypted_key) VALUES (?, ?, ?) ON CONFLICT(user_id, provider) DO UPDATE SET encrypted_key = excluded.encrypted_key'
  ).run(userId, provider, encryptedKey)
}

export function getUserApiKeyEncrypted(userId: string, provider: string): string | null {
  const row = getDb().prepare('SELECT encrypted_key FROM api_keys WHERE user_id = ? AND provider = ?').get(userId, provider) as { encrypted_key: string } | undefined
  return row ? row.encrypted_key : null
}
