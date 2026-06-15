/**
 * Process-wide running tally of tokens saved by context optimization —
 * both compression (whitespace/boilerplate stripping) and history trimming.
 * Surfaced in the status bar as "K optimized".
 */
let totalTokensOptimized = 0

export function addTokensOptimized(n: number): void {
  if (n > 0) totalTokensOptimized += n
}

export function getTokensOptimized(): number {
  return totalTokensOptimized
}
