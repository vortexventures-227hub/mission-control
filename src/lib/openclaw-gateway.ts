import { runOpenClaw } from './command'

export function parseGatewayJsonOutput(raw: string): unknown | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null

  const objectStart = trimmed.indexOf('{')
  const arrayStart = trimmed.indexOf('[')
  const hasObject = objectStart >= 0
  const hasArray = arrayStart >= 0

  let start = -1
  let end = -1

  if (hasObject && hasArray) {
    if (objectStart < arrayStart) {
      start = objectStart
      end = trimmed.lastIndexOf('}')
    } else {
      start = arrayStart
      end = trimmed.lastIndexOf(']')
    }
  } else if (hasObject) {
    start = objectStart
    end = trimmed.lastIndexOf('}')
  } else if (hasArray) {
    start = arrayStart
    end = trimmed.lastIndexOf(']')
  }

  if (start < 0 || end < start) return null

  try {
    return JSON.parse(trimmed.slice(start, end + 1))
  } catch {
    return null
  }
}

export async function callOpenClawGateway<T = unknown>(
  method: string,
  params: unknown,
  timeoutMs = 10000,
): Promise<T> {
  const result = await runOpenClaw(
    [
      'gateway',
      'call',
      method,
      '--timeout',
      String(Math.max(1000, Math.floor(timeoutMs))),
      '--params',
      JSON.stringify(params ?? {}),
      '--json',
    ],
    { timeoutMs: timeoutMs + 2000 },
  )

  const payload = parseGatewayJsonOutput(result.stdout)
  if (payload == null) {
    throw new Error(`Invalid JSON response from gateway method ${method}`)
  }

  return payload as T
}


/**
 * Terminate a gateway session over the gateway's HTTP interface.
 *
 * The gateway exposes `POST /sessions/{key}/kill` (openclaw dist
 * session-kill-http.ts). This is deliberately NOT routed through
 * `openclaw gateway call`: there is no `sessions_kill` RPC, and shelling out
 * put a subprocess between the route and its response — when that child hung,
 * the HTTP handler never answered at all.
 *
 * AbortController bounds the request so this always settles and the caller can
 * always write a response.
 */
export async function killGatewaySession(
  sessionKey: string,
  timeoutMs = 10000,
): Promise<{ ok: boolean; killed?: unknown; status: number }> {
  const host = process.env.OPENCLAW_GATEWAY_HOST || '127.0.0.1'
  const port = process.env.OPENCLAW_GATEWAY_PORT || '18789'
  const url = `http://${host}:${port}/sessions/${encodeURIComponent(sessionKey)}/kill`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs))
  try {
    const res = await fetch(url, { method: 'POST', signal: controller.signal })
    const text = await res.text()
    let parsed: unknown = null
    try { parsed = text ? JSON.parse(text) : null } catch { parsed = text }
    if (!res.ok) {
      throw new Error(`Gateway kill failed (${res.status}) for session ${sessionKey}: ${text || res.statusText}`)
    }
    return { ok: true, killed: parsed, status: res.status }
  } finally {
    clearTimeout(timer)
  }
}


/**
 * Gateway liveness over its own HTTP interface.
 *
 * Deliberately NOT `openclaw gateway call`. On openclaw 2026.7 the gateway
 * answers correctly — its log records sessions.list responses in 162-454ms —
 * but the CLI client never returns them, so anything routed through the CLI
 * hangs regardless of gateway health. The gateway serves plain JSON on
 * /healthz, which is a real end-to-end check with no subprocess involved.
 */
export async function gatewayHttpHealth(
  timeoutMs = 4000,
): Promise<{ ok: boolean; status: number; body: string }> {
  const host = process.env.OPENCLAW_GATEWAY_HOST || '127.0.0.1'
  const port = process.env.OPENCLAW_GATEWAY_PORT || '18789'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(500, timeoutMs))
  try {
    const res = await fetch(`http://${host}:${port}/healthz`, { signal: controller.signal })
    const body = (await res.text()).slice(0, 200)
    return { ok: res.ok, status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}
