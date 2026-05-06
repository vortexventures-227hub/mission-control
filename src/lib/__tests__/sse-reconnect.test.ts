import { describe, expect, it } from 'vitest'
import { classifySseReconnect, isLocalSseHost } from '@/lib/sse-reconnect'

describe('SSE reconnect classification', () => {
  it('keeps early localhost reconnects low-noise', () => {
    const classification = classifySseReconnect({
      attempt: 1,
      maxAttempts: 20,
      isLocalHost: true,
    })

    expect(classification.level).toBe('info')
    expect(classification.category).toBe('transient_local_dev')
    expect(classification.message).toContain('transient local/dev')
    expect(classification.shouldRetry).toBe(true)
  })

  it('escalates persistent reconnects toward auth and runtime checks', () => {
    const classification = classifySseReconnect({
      attempt: 5,
      maxAttempts: 20,
      isLocalHost: true,
      visibilityState: 'visible',
    })

    expect(classification.level).toBe('warn')
    expect(classification.category).toBe('attention_required')
    expect(classification.message).toContain('/api/events viewer auth')
    expect(classification.shouldRetry).toBe(true)
  })

  it('does not hide exhausted reconnect loops', () => {
    const classification = classifySseReconnect({
      attempt: 21,
      maxAttempts: 20,
      isLocalHost: true,
    })

    expect(classification.level).toBe('error')
    expect(classification.category).toBe('exhausted')
    expect(classification.message).toContain('viewer auth')
    expect(classification.message).toContain('runtime')
    expect(classification.shouldRetry).toBe(false)
  })

  it('recognizes local event-stream hosts', () => {
    expect(isLocalSseHost('localhost')).toBe(true)
    expect(isLocalSseHost('127.0.0.1')).toBe(true)
    expect(isLocalSseHost('::1')).toBe(true)
    expect(isLocalSseHost('mission-control.blackwire.local')).toBe(false)
  })
})
