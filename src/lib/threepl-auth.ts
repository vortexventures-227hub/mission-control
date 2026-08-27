import { randomBytes } from 'crypto'
import type Database from 'better-sqlite3'
import { getDatabase } from './db'
import { hashPassword } from './password'

const DEFAULT_THREEPL_AUTH_ORIGIN = 'https://api.3plconnect.ai'
const VORTEX_EMAIL_DOMAIN = 'vortexventures.ai'
const THREEPL_AUTH_TIMEOUT_MS = 8_000

export type ThreePlIdentity = {
  providerUserId: string
  email: string
  displayName: string
}

export type ThreePlAuthFailureCode =
  | 'not_vortex_identity'
  | 'invalid_credentials'
  | 'account_unavailable'
  | 'two_factor_required'
  | 'identity_mismatch'
  | 'upstream_unavailable'

export type ThreePlAuthResult =
  | { ok: true; identity: ThreePlIdentity }
  | { ok: false; code: ThreePlAuthFailureCode }

export type ThreePlMissionControlUser = {
  id: number
  username: string
  display_name: string
  role: 'admin' | 'operator' | 'viewer'
  provider: 'threepl'
  provider_user_id: string | null
  email: string
  avatar_url: string | null
  is_approved: number
  workspace_id: number
  tenant_id: number
  created_at: number
  updated_at: number
  last_login_at: number | null
}

type ThreePlAccountPayload = {
  id?: unknown
  email?: unknown
  displayName?: unknown
  authStatus?: unknown
  accountStatus?: unknown
}

type ThreePlLoginEnvelope = {
  ok?: unknown
  data?: {
    account?: ThreePlAccountPayload | null
    session?: unknown
    twoFactorRequired?: unknown
  } | null
  details?: {
    errorCode?: unknown
  } | null
}

function normalizedOrigin(value: string | undefined): string {
  const candidate = String(value || DEFAULT_THREEPL_AUTH_ORIGIN).trim().replace(/\/+$/, '')
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:') return DEFAULT_THREEPL_AUTH_ORIGIN
    return url.origin
  } catch {
    return DEFAULT_THREEPL_AUTH_ORIGIN
  }
}

export function normalizeVortexEmail(value: unknown): string | null {
  const email = String(value || '').trim().toLowerCase()
  const separator = email.lastIndexOf('@')
  if (separator <= 0 || separator === email.length - 1) return null
  if (email.slice(separator + 1) !== VORTEX_EMAIL_DOMAIN) return null
  return email
}

function issuedSessionCredential(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const session = value as Record<string, unknown>
  const candidate = session.accessToken || session.jwt || session.tokenRef
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

async function revokeIssuedThreePlSession(input: {
  credential: string
  fetchImpl: typeof fetch
  origin: string
}): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await input.fetchImpl(`${input.origin}/auth/logout`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${input.credential}`,
          'content-type': 'application/json',
          'user-agent': 'vv-mission-control/threepl-identity-bridge',
        },
        body: '{}',
        signal: AbortSignal.timeout(THREEPL_AUTH_TIMEOUT_MS),
        cache: 'no-store',
      })
      if (response.ok) return true
    } catch {
      // Retry once. The credential stays server-only and is never logged.
    }
  }
  return false
}

export async function authenticateVortexThreePlIdentity(input: {
  email: unknown
  password: unknown
  fetchImpl?: typeof fetch
  authOrigin?: string
}): Promise<ThreePlAuthResult> {
  const email = normalizeVortexEmail(input.email)
  const password = typeof input.password === 'string' ? input.password : ''
  if (!email || !password) return { ok: false, code: 'not_vortex_identity' }

  const fetchImpl = input.fetchImpl || fetch
  const origin = normalizedOrigin(input.authOrigin || process.env.THREEPL_AUTH_ORIGIN)

  let response: Response
  try {
    response = await fetchImpl(`${origin}/auth/login`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'vv-mission-control/threepl-identity-bridge',
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(THREEPL_AUTH_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch {
    return { ok: false, code: 'upstream_unavailable' }
  }

  const payload = await response.json().catch(() => null) as ThreePlLoginEnvelope | null
  if (!response.ok || payload?.ok !== true) {
    const upstreamCode = String(payload?.details?.errorCode || '')
    if (upstreamCode === 'account_frozen' || upstreamCode === 'password_reset_required') {
      return { ok: false, code: 'account_unavailable' }
    }
    return { ok: false, code: 'invalid_credentials' }
  }

  if (payload.data?.twoFactorRequired === true) {
    return { ok: false, code: 'two_factor_required' }
  }

  const account = payload.data?.account
  const issuedCredential = issuedSessionCredential(payload.data?.session)
  if (!account || !issuedCredential) {
    return { ok: false, code: 'account_unavailable' }
  }

  // Password validation on 3PL Connect issues a real seven-day session. VVCC
  // needs only the verified identity, never that credential, so revoke the
  // just-issued session before inspecting or returning the identity.
  const revoked = await revokeIssuedThreePlSession({ credential: issuedCredential, fetchImpl, origin })
  if (!revoked) return { ok: false, code: 'upstream_unavailable' }

  const authenticatedEmail = normalizeVortexEmail(account.email)
  if (!authenticatedEmail || authenticatedEmail !== email) {
    return { ok: false, code: 'identity_mismatch' }
  }

  if (account.authStatus !== 'verified' || (account.accountStatus && account.accountStatus !== 'active')) {
    return { ok: false, code: 'account_unavailable' }
  }

  const providerUserId = String(account.id || '').trim()
  if (!providerUserId) return { ok: false, code: 'account_unavailable' }

  const displayName = String(account.displayName || email.split('@')[0]).trim() || email.split('@')[0]
  return {
    ok: true,
    identity: {
      providerUserId,
      email,
      displayName,
    },
  }
}

function defaultThreePlRole(env: NodeJS.ProcessEnv): ThreePlMissionControlUser['role'] {
  const configured = String(env.MC_THREEPL_DEFAULT_ROLE || '').trim().toLowerCase()
  return configured === 'viewer' || configured === 'operator' || configured === 'admin'
    ? configured
    : 'operator'
}

function defaultWorkspace(db: Database.Database): { workspaceId: number; tenantId: number } {
  const row = db.prepare(`
    SELECT id, tenant_id
    FROM workspaces
    ORDER BY CASE WHEN slug = 'default' THEN 0 ELSE 1 END, id ASC
    LIMIT 1
  `).get() as { id?: number; tenant_id?: number } | undefined
  return { workspaceId: row?.id || 1, tenantId: row?.tenant_id || 1 }
}

const READ_THREEPL_USER = `
  SELECT u.id, u.username, u.display_name, u.role, 'threepl' as provider,
         u.provider_user_id, u.email, u.avatar_url, u.is_approved, u.workspace_id,
         COALESCE(w.tenant_id, 1) as tenant_id,
         u.created_at, u.updated_at, u.last_login_at
  FROM users u
  LEFT JOIN workspaces w ON w.id = u.workspace_id
  WHERE u.id = ?
`

export function resolveOrProvisionThreePlUser(
  identity: ThreePlIdentity,
  options: {
    db?: Database.Database
    env?: NodeJS.ProcessEnv
  } = {},
): ThreePlMissionControlUser | null {
  const email = normalizeVortexEmail(identity.email)
  const providerUserId = String(identity.providerUserId || '').trim()
  if (!email || !providerUserId) return null

  const db = options.db || getDatabase()
  const env = options.env || process.env
  const { workspaceId } = defaultWorkspace(db)
  const now = Math.floor(Date.now() / 1000)

  const existing = db.prepare(`
    SELECT id, is_approved
    FROM users
    WHERE (provider = 'threepl' AND provider_user_id = ?)
       OR lower(email) = ?
       OR lower(username) = ?
    ORDER BY CASE WHEN provider = 'threepl' AND provider_user_id = ? THEN 0 ELSE 1 END, id ASC
    LIMIT 1
  `).get(providerUserId, email, email, providerUserId) as { id: number; is_approved: number } | undefined

  if (existing) {
    if (Number(existing.is_approved ?? 1) !== 1) return null
    db.prepare(`
      UPDATE users
      SET username = ?, display_name = ?, provider = 'threepl', provider_user_id = ?,
          email = ?, updated_at = ?
      WHERE id = ?
    `).run(email, identity.displayName, providerUserId, email, now, existing.id)
    return db.prepare(READ_THREEPL_USER).get(existing.id) as ThreePlMissionControlUser
  }

  const role = defaultThreePlRole(env)
  const unusablePassword = randomBytes(32).toString('hex')
  const result = db.prepare(`
    INSERT INTO users (
      username, display_name, password_hash, role, provider, provider_user_id,
      email, is_approved, approved_by, approved_at, workspace_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'threepl', ?, ?, 1, '3pl_connect_identity', ?, ?, ?, ?)
  `).run(
    email,
    identity.displayName,
    hashPassword(unusablePassword),
    role,
    providerUserId,
    email,
    now,
    workspaceId,
    now,
    now,
  )

  return db.prepare(READ_THREEPL_USER).get(Number(result.lastInsertRowid)) as ThreePlMissionControlUser
}
