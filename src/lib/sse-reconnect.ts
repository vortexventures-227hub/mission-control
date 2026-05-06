export type SseReconnectLevel = 'info' | 'warn' | 'error'

export interface SseReconnectClassificationInput {
  attempt: number
  maxAttempts: number
  isLocalHost?: boolean
  isOffline?: boolean
  visibilityState?: DocumentVisibilityState
}

export interface SseReconnectClassification {
  level: SseReconnectLevel
  category: 'transient_local_dev' | 'attention_required' | 'exhausted'
  message: string
  shouldRetry: boolean
}

export function isLocalSseHost(hostname: string | undefined) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

export function classifySseReconnect({
  attempt,
  maxAttempts,
  isLocalHost = false,
  isOffline = false,
  visibilityState = 'visible',
}: SseReconnectClassificationInput): SseReconnectClassification {
  if (attempt > maxAttempts) {
    return {
      level: 'error',
      category: 'exhausted',
      message: `SSE reconnect attempts exhausted after ${maxAttempts} tries; verify /api/events viewer auth, local server runtime, and proxy timeouts.`,
      shouldRetry: false,
    }
  }

  if (isOffline) {
    return {
      level: 'warn',
      category: 'attention_required',
      message: 'SSE reconnect paused by browser offline state; local command data may be stale until the network returns.',
      shouldRetry: true,
    }
  }

  if (isLocalHost && attempt <= 2) {
    return {
      level: 'info',
      category: 'transient_local_dev',
      message: 'classified as transient local/dev SSE reconnect',
      shouldRetry: true,
    }
  }

  if (isLocalHost && visibilityState === 'hidden' && attempt <= 4) {
    return {
      level: 'info',
      category: 'transient_local_dev',
      message: 'classified as background-tab local/dev SSE reconnect',
      shouldRetry: true,
    }
  }

  return {
    level: 'warn',
    category: 'attention_required',
    message: 'SSE reconnect is still failing; if this persists, check /api/events viewer auth and local runtime health.',
    shouldRetry: true,
  }
}
