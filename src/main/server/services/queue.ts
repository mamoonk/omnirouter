const RETRY_DELAYS = [30_000, 60_000, 120_000]

interface QueueItem {
  id: string
  retryAt: number
  attempt: number
  retry: () => Promise<void>
}

const queue: QueueItem[] = []
let timer: ReturnType<typeof setTimeout> | null = null

export function enqueue(
  id: string,
  retryFn: () => Promise<void>
): void {
  queue.push({
    id,
    retryAt: Date.now() + RETRY_DELAYS[0],
    attempt: 0,
    retry: retryFn
  })
  schedule()
}

export function getQueueSize(): number {
  return queue.length
}

function schedule(): void {
  if (timer) return
  if (queue.length === 0) return

  const now = Date.now()
  const next = queue.reduce((earliest, item) =>
    item.retryAt < earliest ? item.retryAt : earliest, Infinity
  )

  const delay = Math.max(0, next - now)

  timer = setTimeout(async () => {
    timer = null
    await processDue()
    schedule()
  }, delay)
}

async function processDue(): Promise<void> {
  const now = Date.now()
  const due = queue.filter((item) => item.retryAt <= now)

  for (const item of due) {
    const idx = queue.indexOf(item)
    if (idx === -1) continue
    queue.splice(idx, 1)

    if (item.attempt >= 3) {
      continue
    }

    item.attempt++
    item.retryAt = now + (RETRY_DELAYS[item.attempt] || 120_000)

    try {
      await item.retry()
      continue
    } catch {
      queue.push(item)
    }
  }
}
