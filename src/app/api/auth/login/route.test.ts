import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authenticateUser: vi.fn(),
  createSession: vi.fn(),
  authenticateVortexThreePlIdentity: vi.fn(),
  normalizeVortexEmail: vi.fn(),
  resolveOrProvisionThreePlUser: vi.fn(),
  logAuditEvent: vi.fn(),
  needsFirstTimeSetup: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authenticateUser: mocks.authenticateUser,
  createSession: mocks.createSession,
}))

vi.mock('@/lib/threepl-auth', () => ({
  authenticateVortexThreePlIdentity: mocks.authenticateVortexThreePlIdentity,
  normalizeVortexEmail: mocks.normalizeVortexEmail,
  resolveOrProvisionThreePlUser: mocks.resolveOrProvisionThreePlUser,
}))

vi.mock('@/lib/db', () => ({
  logAuditEvent: mocks.logAuditEvent,
  needsFirstTimeSetup: mocks.needsFirstTimeSetup,
}))

vi.mock('@/lib/rate-limit', () => ({ loginLimiter: () => null }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { POST } from './route'

function loginRequest(username: string, password: string): Request {
  return new Request('https://vv-mission-control.fly.dev/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vvcc-auth-test',
      'x-forwarded-for': '203.0.113.10',
      'x-forwarded-proto': 'https',
    },
    body: JSON.stringify({ username, password }),
  })
}

const threePlUser = {
  id: 17,
  username: 'ryu@vortexventures.ai',
  display_name: 'Ryu',
  role: 'operator' as const,
  provider: 'threepl' as const,
  provider_user_id: '3pl-user-ryu',
  email: 'ryu@vortexventures.ai',
  avatar_url: null,
  is_approved: 1,
  workspace_id: 1,
  tenant_id: 1,
  created_at: 1,
  updated_at: 1,
  last_login_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.needsFirstTimeSetup.mockReturnValue(false)
  mocks.createSession.mockReturnValue({ token: 'vvcc-session-token', expiresAt: Math.floor(Date.now() / 1000) + 3600 })
  mocks.normalizeVortexEmail.mockImplementation((value: unknown) => {
    const email = String(value || '').trim().toLowerCase()
    return email.endsWith('@vortexventures.ai') ? email : null
  })
})

describe('VVCC 3PL Connect login route', () => {
  it('exchanges a verified Vortex identity for a VVCC-only session cookie', async () => {
    mocks.authenticateVortexThreePlIdentity.mockResolvedValue({
      ok: true,
      identity: {
        providerUserId: '3pl-user-ryu',
        email: 'ryu@vortexventures.ai',
        displayName: 'Ryu',
      },
    })
    mocks.resolveOrProvisionThreePlUser.mockReturnValue(threePlUser)

    const response = await POST(loginRequest('RYU@vortexventures.ai', 'existing-3pl-password'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('__Host-mc-session=vvcc-session-token')
    expect(payload.user).toMatchObject({
      username: 'ryu@vortexventures.ai',
      provider: 'threepl',
      role: 'operator',
    })
    expect(JSON.stringify(payload)).not.toContain('existing-3pl-password')
    expect(JSON.stringify(payload)).not.toContain('3pl-user-ryu')
    expect(mocks.authenticateUser).not.toHaveBeenCalled()
    expect(mocks.createSession).toHaveBeenCalledWith(17, '203.0.113.10', 'vvcc-auth-test', 1)
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'login_3pl_connect' }))
  })

  it('returns a bounded unavailable state without minting a VVCC session', async () => {
    mocks.authenticateVortexThreePlIdentity.mockResolvedValue({ ok: false, code: 'upstream_unavailable' })

    const response = await POST(loginRequest('ryu@vortexventures.ai', 'existing-3pl-password'))
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({
      error: '3PL Connect sign-in is temporarily unavailable. Try again.',
      code: 'THREEPL_AUTH_UNAVAILABLE',
    })
    expect(mocks.createSession).not.toHaveBeenCalled()
    expect(mocks.resolveOrProvisionThreePlUser).not.toHaveBeenCalled()
  })

  it('preserves local login for a non-email break-glass account', async () => {
    mocks.authenticateUser.mockReturnValue({
      ...threePlUser,
      id: 1,
      username: 'admin',
      provider: 'local',
      email: null,
      role: 'admin',
    })

    const response = await POST(loginRequest('admin', 'local-break-glass-password'))

    expect(response.status).toBe(200)
    expect(mocks.authenticateUser).toHaveBeenCalledWith('admin', 'local-break-glass-password')
    expect(mocks.authenticateVortexThreePlIdentity).not.toHaveBeenCalled()
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'login' }))
  })
})
