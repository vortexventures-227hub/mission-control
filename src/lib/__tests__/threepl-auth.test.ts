import { afterEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import {
  authenticateVortexThreePlIdentity,
  normalizeVortexEmail,
  resolveOrProvisionThreePlUser,
} from '@/lib/threepl-auth'

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function successfulEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    data: {
      account: {
        id: '3pl-user-ryu',
        email: 'ryu@vortexventures.ai',
        displayName: 'Ryu',
        authStatus: 'verified',
        accountStatus: 'active',
        ...overrides,
      },
      session: {
        tokenRef: 'must-never-leave-the-server-side-response',
      },
    },
  }
}

describe('3PL Connect identity verification', () => {
  it('accepts only the exact Vortex Ventures email domain', () => {
    expect(normalizeVortexEmail(' RYU@VORTEXVENTURES.AI ')).toBe('ryu@vortexventures.ai')
    expect(normalizeVortexEmail('ryu@sub.vortexventures.ai')).toBeNull()
    expect(normalizeVortexEmail('ryu@vortexventures.ai.attacker.test')).toBeNull()
    expect(normalizeVortexEmail('vortexventures.ai')).toBeNull()
  })

  it('validates against the fixed server-side 3PL login route and returns no session material', async () => {
    let call = 0
    const wrappedFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      call += 1
      if (call === 1) {
        expect(String(url)).toBe('https://api.3plconnect.ai/auth/login')
        expect(JSON.parse(String(init?.body))).toEqual({
          email: 'ryu@vortexventures.ai',
          password: 'existing-3pl-password',
        })
        return response(successfulEnvelope())
      }
      expect(String(url)).toBe('https://api.3plconnect.ai/auth/logout')
      expect(String(new Headers(init?.headers).get('authorization'))).toBe('Bearer must-never-leave-the-server-side-response')
      return response({ ok: true })
    }) as unknown as typeof fetch

    const result = await authenticateVortexThreePlIdentity({
      email: 'RYU@vortexventures.ai',
      password: 'existing-3pl-password',
      fetchImpl: wrappedFetch,
    })

    expect(wrappedFetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      ok: true,
      identity: {
        providerUserId: '3pl-user-ryu',
        email: 'ryu@vortexventures.ai',
        displayName: 'Ryu',
      },
    })
    expect(JSON.stringify(result)).not.toContain('tokenRef')
    expect(JSON.stringify(result)).not.toContain('existing-3pl-password')
  })

  it('refuses a successful upstream response whose identity does not match the submitted email', async () => {
    let call = 0
    const fetchImpl = vi.fn(async () => {
      call += 1
      return call === 1
        ? response(successfulEnvelope({ email: 'other@vortexventures.ai' }))
        : response({ ok: true })
    }) as unknown as typeof fetch
    const result = await authenticateVortexThreePlIdentity({
      email: 'ryu@vortexventures.ai',
      password: 'existing-3pl-password',
      fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ ok: false, code: 'identity_mismatch' })
  })

  it('does not accept an upstream success without an issued session', async () => {
    const body = successfulEnvelope()
    body.data.session = null as unknown as { tokenRef: string }
    const fetchImpl = vi.fn(async () => response(body)) as unknown as typeof fetch
    const result = await authenticateVortexThreePlIdentity({
      email: 'ryu@vortexventures.ai',
      password: 'existing-3pl-password',
      fetchImpl,
    })
    expect(result).toEqual({ ok: false, code: 'account_unavailable' })
  })

  it('keeps 2FA fail-closed rather than minting a VVCC session after password-only proof', async () => {
    const body = successfulEnvelope()
    body.data.account = null as unknown as typeof body.data.account
    body.data.session = null as unknown as typeof body.data.session
    Object.assign(body.data, { twoFactorRequired: true })
    const fetchImpl = vi.fn(async () => response(body)) as unknown as typeof fetch
    const result = await authenticateVortexThreePlIdentity({
      email: 'ryu@vortexventures.ai',
      password: 'existing-3pl-password',
      fetchImpl,
    })
    expect(result).toEqual({ ok: false, code: 'two_factor_required' })
  })

  it('never calls the upstream for a non-Vortex identity', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const result = await authenticateVortexThreePlIdentity({
      email: 'ryu@example.com',
      password: 'anything',
      fetchImpl,
    })
    expect(result).toEqual({ ok: false, code: 'not_vortex_identity' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not mint a VVCC identity when the just-issued 3PL session cannot be revoked', async () => {
    let call = 0
    const fetchImpl = vi.fn(async () => {
      call += 1
      return call === 1 ? response(successfulEnvelope()) : response({ ok: false }, 503)
    }) as unknown as typeof fetch

    const result = await authenticateVortexThreePlIdentity({
      email: 'ryu@vortexventures.ai',
      password: 'existing-3pl-password',
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(result).toEqual({ ok: false, code: 'upstream_unavailable' })
  })
})

function createUserSchema(db: InstanceType<typeof Database>) {
  db.exec(`
    CREATE TABLE workspaces (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL,
      tenant_id INTEGER NOT NULL
    );
    INSERT INTO workspaces (id, slug, tenant_id) VALUES (1, 'default', 7);

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      provider TEXT NOT NULL DEFAULT 'local',
      provider_user_id TEXT,
      email TEXT,
      avatar_url TEXT,
      is_approved INTEGER NOT NULL DEFAULT 1,
      approved_by TEXT,
      approved_at INTEGER,
      workspace_id INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    );
  `)
}

let db: InstanceType<typeof Database>

afterEach(() => {
  db?.close()
})

describe('3PL Connect Mission Control user provisioning', () => {
  it('creates an approved operator with an unusable local password and preserved tenant context', () => {
    db = new Database(':memory:')
    createUserSchema(db)

    const user = resolveOrProvisionThreePlUser({
      providerUserId: '3pl-user-ryu',
      email: 'ryu@vortexventures.ai',
      displayName: 'Ryu',
    }, { db, env: {} })

    expect(user).toMatchObject({
      username: 'ryu@vortexventures.ai',
      email: 'ryu@vortexventures.ai',
      display_name: 'Ryu',
      provider: 'threepl',
      provider_user_id: '3pl-user-ryu',
      role: 'operator',
      workspace_id: 1,
      tenant_id: 7,
      is_approved: 1,
    })

    const stored = db.prepare('SELECT password_hash, approved_by FROM users WHERE id = ?').get(user?.id) as Record<string, unknown>
    expect(String(stored.password_hash)).not.toContain('existing-3pl-password')
    expect(stored.approved_by).toBe('3pl_connect_identity')
  })

  it('links an existing email account without changing its role', () => {
    db = new Database(':memory:')
    createUserSchema(db)
    db.prepare(`
      INSERT INTO users (
        username, display_name, password_hash, role, provider, email,
        workspace_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'admin', 'local', ?, 1, 1, 1)
    `).run('ryu@vortexventures.ai', 'Old name', 'old-local-hash', 'ryu@vortexventures.ai')

    const user = resolveOrProvisionThreePlUser({
      providerUserId: '3pl-user-ryu',
      email: 'ryu@vortexventures.ai',
      displayName: 'Ryu',
    }, { db, env: { MC_THREEPL_DEFAULT_ROLE: 'viewer' } })

    expect(user).toMatchObject({
      username: 'ryu@vortexventures.ai',
      provider: 'threepl',
      role: 'admin',
    })
    expect((db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count).toBe(1)
  })

  it('refuses a disabled matching VVCC user', () => {
    db = new Database(':memory:')
    createUserSchema(db)
    db.prepare(`
      INSERT INTO users (
        username, display_name, password_hash, provider, provider_user_id, email,
        is_approved, workspace_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'threepl', ?, ?, 0, 1, 1, 1)
    `).run('ryu@vortexventures.ai', 'Ryu', 'disabled-hash', '3pl-user-ryu', 'ryu@vortexventures.ai')

    const user = resolveOrProvisionThreePlUser({
      providerUserId: '3pl-user-ryu',
      email: 'ryu@vortexventures.ai',
      displayName: 'Ryu',
    }, { db, env: {} })

    expect(user).toBeNull()
  })
})
