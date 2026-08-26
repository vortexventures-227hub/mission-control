import { randomUUID, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Direct WebSocket transport to the OpenClaw gateway.
 *
 * WHY THIS EXISTS. Every gateway call used to shell out to
 * `openclaw gateway call`. On openclaw 2026.7 that CLI never returns: the
 * gateway answers correctly — its own log records sessions.list responses in
 * 162-454ms — but the wrapper does not print or exit, so every caller hung
 * until its own timeout. Spawn, session list, monitor/pause, transcript,
 * channels, nodes, chat and task-dispatch were all affected.
 *
 * The contract below was verified against the running gateway, not inferred:
 *
 *   frame      {"type":"req","id":<uuid>,"method":<m>,"params":{...}}
 *   handshake  server emits {"type":"event","event":"connect.challenge",
 *              "payload":{"nonce"}}; the client must call `connect` first
 *   protocol   minProtocol/maxProtocol = 4 (3 is rejected, expectedProtocol 4)
 *   client     { id:"cli", mode:"cli", platform, version }
 *   device     REQUIRED even when the gateway runs auth mode none — every
 *              client mode returns NOT_PAIRED/DEVICE_IDENTITY_REQUIRED without
 *              it, and a device token on its own is NOT sufficient
 *   signature  ed25519 over
 *              ["v3",deviceId,clientId,clientMode,role,scopes.join(","),
 *               String(signedAtMs),token,nonce,platform,deviceFamily].join("|")
 *
 * The device identity is the one the CLI already paired, read from the
 * OpenClaw home on the persistent volume — we do not mint a new one.
 */

type DeviceIdentity = { deviceId: string; publicKeyPem: string; privateKeyPem: string }
type OperatorToken = { token: string; role: string; scopes: string[] }

function openclawHome(): string {
  const base = process.env.OPENCLAW_HOME || '/app/.data/openclaw'
  // The CLI nests its state under a `.openclaw` directory inside OPENCLAW_HOME.
  return path.join(base, '.openclaw')
}

function readIdentity(): { device: DeviceIdentity; operator: OperatorToken } {
  const home = openclawHome()
  const device = JSON.parse(readFileSync(path.join(home, 'identity/device.json'), 'utf8'))
  const auth = JSON.parse(readFileSync(path.join(home, 'identity/device-auth.json'), 'utf8'))
  const operator = auth?.tokens?.operator
  if (!device?.deviceId || !device?.privateKeyPem) throw new Error('gateway device identity is incomplete')
  if (!operator?.token) throw new Error('gateway operator token is missing')
  return {
    device,
    operator: { token: operator.token, role: operator.role, scopes: Array.isArray(operator.scopes) ? operator.scopes : [] },
  }
}

/** Matches the gateway's normalizeDeviceMetadataForAuth. */
const normalizeMeta = (value?: string) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

export async function gatewayWsCall<T = unknown>(
  method: string,
  params: unknown,
  timeoutMs = 10000,
): Promise<T> {
  const host = process.env.OPENCLAW_GATEWAY_HOST || '127.0.0.1'
  const port = process.env.OPENCLAW_GATEWAY_PORT || '18789'
  const { device, operator } = readIdentity()

  return await new Promise<T>((resolve, reject) => {
    let settled = false
    const ws = new WebSocket(`ws://${host}:${port}`)

    // Single settle point. Every path — timeout, socket error, close, gateway
    // error — must land here, or a caller can await forever and its route will
    // never write a response. That failure mode is exactly what this transport
    // replaces.
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { ws.close() } catch { /* already closing */ }
      fn()
    }
    const timer = setTimeout(
      () => finish(() => reject(new Error(`gateway call timed out after ${timeoutMs}ms (${method})`))),
      Math.max(1000, timeoutMs),
    )

    let connectId: string | null = null
    let callId: string | null = null

    const send = (m: string, p: unknown) => {
      const id = randomUUID()
      ws.send(JSON.stringify({ type: 'req', id, method: m, params: p ?? {} }))
      return id
    }

    ws.addEventListener('message', (event: MessageEvent) => {
      let frame: any
      try {
        frame = JSON.parse(typeof event.data === 'string' ? event.data : String(event.data))
      } catch {
        return
      }

      if (frame?.event === 'connect.challenge') {
        const nonce = frame?.payload?.nonce
        if (typeof nonce !== 'string' || !nonce) {
          finish(() => reject(new Error('gateway connect challenge missing nonce')))
          return
        }
        const signedAtMs = Date.now()
        const clientId = 'cli'
        const clientMode = 'cli'
        const platform = 'linux'
        const payload = [
          'v3', device.deviceId, clientId, clientMode, operator.role,
          operator.scopes.join(','), String(signedAtMs), operator.token, nonce,
          normalizeMeta(platform), normalizeMeta(undefined),
        ].join('|')
        const signature = sign(null, Buffer.from(payload), device.privateKeyPem).toString('base64')
        connectId = send('connect', {
          minProtocol: 4,
          maxProtocol: 4,
          client: { id: clientId, mode: clientMode, platform, version: '2.0.1' },
          role: operator.role,
          scopes: operator.scopes,
          auth: { deviceToken: operator.token },
          device: { id: device.deviceId, publicKey: device.publicKeyPem, signature, signedAt: signedAtMs, nonce },
        })
        return
      }

      if (frame?.type !== 'res') return

      if (connectId && frame.id === connectId) {
        if (!frame.ok) {
          const message = frame?.error?.message || 'gateway connect rejected'
          finish(() => reject(new Error(`gateway connect failed: ${message}`)))
          return
        }
        callId = send(method, params)
        return
      }

      if (callId && frame.id === callId) {
        if (!frame.ok) {
          const message = frame?.error?.message || `gateway method ${method} failed`
          finish(() => reject(new Error(message)))
          return
        }
        finish(() => resolve((frame.payload ?? frame.result ?? {}) as T))
      }
    })

    ws.addEventListener('error', () =>
      finish(() => reject(new Error(`gateway socket error (${method})`))))
    ws.addEventListener('close', (event: CloseEvent) =>
      finish(() => reject(new Error(`gateway closed before responding (${method}): ${event.reason || event.code}`))))
  })
}
