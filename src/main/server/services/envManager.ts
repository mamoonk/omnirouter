import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import dotenv from 'dotenv'

const ENV_VARS = [
  'GEMINI_API_KEY', 'GROQ_API_KEY', 'MISTRAL_API_KEY', 'COHERE_API_KEY',
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY', 'TOGETHER_API_KEY',
  'FIREWORKS_API_KEY', 'OPENROUTER_API_KEY', 'NVIDIA_API_KEY', 'PERPLEXITY_API_KEY',
  'XAI_API_KEY', 'EDEN_API_KEY', 'SILICONFLOW_API_KEY', 'HUGGINGFACE_API_KEY',
  'CLOUDFLARE_API_KEY', 'DASHSCOPE_API_KEY', 'AI21_API_KEY', 'CEREBRAS_API_KEY'
]

function getEnvPath(): string {
  return join(app.getPath('userData'), '.env')
}

export function loadEnv(): void {
  const envPath = getEnvPath()
  if (existsSync(envPath)) {
    const parsed = dotenv.parse(readFileSync(envPath, 'utf-8'))
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

export function getApiKeyStatus(): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const key of ENV_VARS) {
    result[key] = Boolean(process.env[key])
  }
  return result
}

export function saveApiKeys(keys: Record<string, string>): void {
  const envPath = getEnvPath()

  let existing = ''
  if (existsSync(envPath)) {
    existing = readFileSync(envPath, 'utf-8')
  }

  const lines = existing.split('\n')
  const updatedLines: string[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      updatedLines.push(line)
      continue
    }
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) {
      updatedLines.push(line)
      continue
    }
    const key = trimmed.slice(0, eqIdx).trim()
    seen.add(key)

    if (keys[key] !== undefined) {
      if (keys[key]) {
        updatedLines.push(`${key}=${keys[key]}`)
      }
      delete keys[key]
    } else {
      updatedLines.push(line)
    }
  }

  for (const [key, value] of Object.entries(keys)) {
    if (value && !seen.has(key)) {
      updatedLines.push(`${key}=${value}`)
    }
  }

  writeFileSync(envPath, updatedLines.join('\n'), 'utf-8')

  for (const [key, value] of Object.entries(keys)) {
    if (value) {
      process.env[key] = value
    }
  }
}
