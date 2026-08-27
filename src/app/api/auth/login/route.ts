import { NextResponse } from 'next/server'
import { authenticateUser, createSession } from '@/lib/auth'
import { logAuditEvent, needsFirstTimeSetup } from '@/lib/db'
import { getMcSessionCookieName, getMcSessionCookieOptions, isRequestSecure } from '@/lib/session-cookie'
import { loginLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  authenticateVortexThreePlIdentity,
  normalizeVortexEmail,
  resolveOrProvisionThreePlUser,
  type ThreePlAuthFailureCode,
} from '@/lib/threepl-auth'

function threePlLoginError(code: ThreePlAuthFailureCode): { status: number; error: string; code: string } {
  switch (code) {
    case 'two_factor_required':
      return {
        status: 403,
        error: 'This 3PL Connect account requires two-factor authentication. Complete sign-in in 3PL Connect first.',
        code: 'THREEPL_TWO_FACTOR_REQUIRED',
      }
    case 'account_unavailable':
      return {
        status: 403,
        error: 'This 3PL Connect account is not currently available for Mission Control access.',
        code: 'THREEPL_ACCOUNT_UNAVAILABLE',
      }
    case 'upstream_unavailable':
      return {
        status: 503,
        error: '3PL Connect sign-in is temporarily unavailable. Try again.',
        code: 'THREEPL_AUTH_UNAVAILABLE',
      }
    case 'not_vortex_identity':
    case 'identity_mismatch':
    case 'invalid_credentials':
    default:
      return { status: 401, error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' }
  }
}

export async function POST(request: Request) {
  try {
    const rateCheck = loginLimiter(request)
    if (rateCheck) return rateCheck

    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    const vortexEmail = normalizeVortexEmail(username)
    let user
    let auditAction = 'login'

    if (vortexEmail) {
      const threePlResult = await authenticateVortexThreePlIdentity({
        email: vortexEmail,
        password,
      })
      if (threePlResult.ok === false) {
        const failure = threePlLoginError(threePlResult.code)
        logAuditEvent({ action: 'login_failed', actor: vortexEmail, ip_address: ipAddress, user_agent: userAgent })
        return NextResponse.json({ error: failure.error, code: failure.code }, { status: failure.status })
      }
      user = resolveOrProvisionThreePlUser(threePlResult.identity)
      auditAction = 'login_3pl_connect'
    } else {
      user = authenticateUser(username, password)
    }

    if (!user) {
      logAuditEvent({ action: 'login_failed', actor: username, ip_address: ipAddress, user_agent: userAgent })

      // When no users exist at all, give actionable feedback instead of "Invalid credentials"
      if (needsFirstTimeSetup()) {
        return NextResponse.json(
          {
            error: 'No admin account has been created yet',
            code: 'NO_USERS',
            hint: 'Visit /setup to create your admin account',
          },
          { status: 401 }
        )
      }

      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const { token, expiresAt } = createSession(user.id, ipAddress, userAgent, user.workspace_id)

    logAuditEvent({ action: auditAction, actor: user.username, actor_id: user.id, ip_address: ipAddress, user_agent: userAgent })

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        provider: user.provider || 'local',
        email: user.email || null,
        avatar_url: user.avatar_url || null,
        workspace_id: user.workspace_id ?? 1,
        tenant_id: user.tenant_id ?? 1,
      },
    })

    const isSecureRequest = isRequestSecure(request)
    const cookieName = getMcSessionCookieName(isSecureRequest)

    response.cookies.set(cookieName, token, {
      ...getMcSessionCookieOptions({ maxAgeSeconds: expiresAt - Math.floor(Date.now() / 1000), isSecureRequest, requestUrl: request.url }),
    })

    return response
  } catch (error) {
    logger.error({ err: error }, 'Login error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
