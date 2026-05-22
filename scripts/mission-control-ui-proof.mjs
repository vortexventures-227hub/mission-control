import { chromium } from '@playwright/test'
import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dbPath = process.env.MISSION_CONTROL_DB_PATH || path.join(root, '.data', 'mission-control.db')
const baseUrl = process.env.MISSION_CONTROL_PROOF_BASE_URL || 'http://127.0.0.1:3104'
const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
const outDir = path.join(root, 'docs', 'outputs', `mission-control-ui-proof-${stamp}`)
fs.mkdirSync(outDir, { recursive: true })

const routes = [
  '/login',
  '/',
  '/mission-control',
  '/command-truth',
  '/group-chat',
  '/rooms/blackwire-ops',
  '/tracker?agent=koda',
  '/tasks',
  '/agents',
  '/exec-approvals',
  '/notifications',
  '/expenses',
  '/knowledge-intake',
  '/research',
  '/content-research',
  '/ai-toolkit',
  '/skills',
  '/think-tank?commercial=1',
  '/brain-memory',
  '/security-command',
  '/security',
  '/marketing',
  '/research-command',
  '/asset-library',
  '/design',
  '/trading',
]

const db = new Database(dbPath)
const now = Math.floor(Date.now() / 1000)
const user = db.prepare(`
  SELECT id, role, username, COALESCE(workspace_id, 1) AS workspace_id
  FROM users
  WHERE COALESCE(is_approved, 1) = 1
  ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'operator' THEN 1 ELSE 2 END, id ASC
  LIMIT 1
`).get()
if (!user) {
  throw new Error('No approved local user exists for temporary UI proof session')
}
const workspace = db.prepare(`SELECT id, COALESCE(tenant_id, 1) AS tenant_id FROM workspaces WHERE id = ? LIMIT 1`).get(user.workspace_id) || { id: 1, tenant_id: 1 }
const token = crypto.randomBytes(32).toString('hex')
const ua = 'mission-control-cron-ui-proof'
db.prepare(`
  INSERT INTO user_sessions (token, user_id, expires_at, ip_address, user_agent, workspace_id, tenant_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(token, user.id, now + 1800, '127.0.0.1', ua, workspace.id, workspace.tenant_id)

const results = []
const consoleMessages = []
let browser
try {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(chromePath) ? chromePath : undefined })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
  await context.addCookies([{ name: 'mc-session', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax', expires: now + 1800 }])
  await context.addInitScript(() => {
    window.sessionStorage.setItem('mc-onboarding-dismissed', '1')
    window.sessionStorage.setItem('mc-commercial-capture', '1')
    window.sessionStorage.removeItem('mc-onboarding-replay')
  })
  const page = await context.newPage()
  page.on('console', msg => {
    if (['error', 'warning'].includes(msg.type())) consoleMessages.push(`${msg.type()}: ${msg.text()}`)
  })
  page.on('pageerror', err => consoleMessages.push(`pageerror: ${err.message}`))

  for (const route of routes) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    if (route !== '/login') {
      await page.waitForFunction(() => {
        const text = document.body?.innerText || ''
        const stillBooting = /Agent Orchestration\s+(Loading active sessions|Detecting station mode|Loading capabilities|Loading configuration)/i.test(text)
        return !stillBooting && text.trim().length > 250
      }, { timeout: 15000 }).catch(() => {})
    }
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(750)
    const details = await page.evaluate(() => {
      const text = document.body?.innerText || ''
      const headings = Array.from(document.querySelectorAll('h1,h2')).slice(0, 8).map(el => el.textContent?.trim()).filter(Boolean)
      return {
        title: document.title,
        textLength: text.trim().length,
        headings,
        hasApplicationError: /Application error|Unhandled Runtime Error|Internal Server Error/i.test(text),
        hasLoginForm: /sign in|login|password/i.test(text),
        firstText: text.trim().replace(/\s+/g, ' ').slice(0, 220),
      }
    })
    const safeName = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^a-z0-9-]+/gi, '_').replace(/^_+|_+$/g, '')
    const screenshot = path.join(outDir, `${safeName || 'home'}.png`)
    await page.screenshot({ path: screenshot, fullPage: true })
    const statusOk = Boolean(response && response.status() >= 200 && response.status() < 400)
    const contentOk = route === '/login'
      ? details.hasLoginForm && details.textLength > 100
      : details.textLength > 250
    results.push({
      route,
      status: response?.status() ?? null,
      ok: Boolean(statusOk && contentOk && !details.hasApplicationError),
      screenshot: path.relative(root, screenshot),
      ...details,
    })
  }
  await browser.close()
} finally {
  if (browser) await browser.close().catch(() => {})
  db.prepare(`DELETE FROM user_sessions WHERE token = ? OR user_agent = ?`).run(token, ua)
}

const remaining = db.prepare(`SELECT count(*) AS count FROM user_sessions WHERE user_agent = ?`).get(ua).count
const summarizeConsole = (messages) => {
  const buckets = new Map()
  for (const message of messages) {
    const key = message.includes('Content Security Policy')
      ? 'CSP inline-script violation'
      : message.includes('hydrated but some attributes')
        ? 'React hydration attribute mismatch warning'
        : message.includes('SSE: Reconnecting')
          ? 'SSE reconnect warning'
          : message.includes('width(-1) and height(-1) of chart')
            ? 'Recharts transient zero-size container warning'
            : message.slice(0, 160)
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }
  return Array.from(buckets.entries()).map(([message, count]) => ({ message, count }))
}

const proof = {
  baseUrl,
  dbPath: path.relative(root, dbPath),
  outDir: path.relative(root, outDir),
  proofUser: { id: user.id, role: user.role, username: user.username },
  sessionCleanupCount: remaining,
  routes: results,
  consoleFindings: summarizeConsole(consoleMessages),
  consoleFindingPolicy: 'Console findings are recorded as caveats. Route pass/fail is based on HTTP status, content presence, application-error text, and session cleanup; do not treat consoleFindings as empty unless the array is empty.',
  passed: results.every(r => r.ok) && remaining === 0,
}
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(proof, null, 2))
console.log(JSON.stringify(proof, null, 2))
