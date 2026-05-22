'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useMissionControl } from '@/store'
import { useNavigateToPanel } from '@/lib/navigation'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { SignalPill, getLocalOsStatus, getProviderHealth, getMcHealth } from './widget-primitives'
import { OnboardingChecklistWidget } from './widgets/onboarding-checklist-widget'
import { EmptyStateLaunchpad } from './empty-state-launchpad'
import { WidgetGrid } from './widget-grid'
import { BoundaryBanner, Btn, Chip, HudPanel, Stat } from '@/components/mc/hud'
import type { DbStats, ClaudeStats, LogLike, DashboardData } from './widget-primitives'

export function Dashboard() {
  const {
    sessions,
    setSessions,
    connection,
    dashboardMode,
    subscription,
    logs,
    agents,
    tasks,
    setActiveConversation,
  } = useMissionControl()

  const navigateToPanel = useNavigateToPanel()
  const isLocal = dashboardMode === 'local'

  const subscriptionLabel = subscription?.type
    ? subscription.type.charAt(0).toUpperCase() + subscription.type.slice(1)
    : null

  const SUBSCRIPTION_PRICES: Record<string, Record<string, number>> = {
    anthropic: { pro: 20, max: 100, max_5x: 200, team: 30, enterprise: 30 },
    openai: { plus: 20, chatgpt: 20, pro: 200, team: 30, enterprise: 0 },
  }

  const subscriptionPrice = subscription?.provider && subscription?.type
    ? SUBSCRIPTION_PRICES[subscription.provider]?.[subscription.type] ?? null
    : null

  const [systemStats, setSystemStats] = useState<any>(null)
  const [dbStats, setDbStats] = useState<DbStats | null>(null)
  const [claudeStats, setClaudeStats] = useState<ClaudeStats | null>(null)
  const [githubStats, setGithubStats] = useState<any>(null)
  const [hermesCronJobCount, setHermesCronJobCount] = useState(0)
  const [loading, setLoading] = useState({
    system: true,
    sessions: true,
    claude: true,
    github: true,
  })

  const loadDashboard = useCallback(async () => {
    const requests: Promise<void>[] = []

    requests.push(
      fetch('/api/status?action=dashboard')
        .then(async (res) => {
          if (!res.ok) return
          const data = await res.json()
          if (data && !data.error) {
            setSystemStats(data)
            if (data.db) setDbStats(data.db)
          }
        })
        .catch(() => {})
        .finally(() => setLoading(prev => ({ ...prev, system: false })))
    )

    requests.push(
      fetch('/api/sessions')
        .then(async (res) => {
          if (!res.ok) return
          const data = await res.json()
          if (data && !data.error) setSessions(data.sessions || data)
        })
        .catch(() => {})
        .finally(() => setLoading(prev => ({ ...prev, sessions: false })))
    )

    if (isLocal) {
      requests.push(
        fetch('/api/claude/sessions')
          .then(async (res) => {
            if (!res.ok) return
            const data = await res.json()
            if (data?.stats) setClaudeStats(data.stats)
          })
          .catch(() => {})
          .finally(() => setLoading(prev => ({ ...prev, claude: false })))
      )

      requests.push(
        fetch('/api/github?action=stats')
          .then(async (res) => {
            if (!res.ok) return
            const data = await res.json()
            if (data && !data.error) setGithubStats(data)
          })
          .catch(() => {})
          .finally(() => setLoading(prev => ({ ...prev, github: false })))
      )

      requests.push(
        fetch('/api/hermes')
          .then(async (res) => {
            if (!res.ok) return
            const data = await res.json()
            if (data?.cronJobCount != null) setHermesCronJobCount(data.cronJobCount)
          })
          .catch(() => {})
      )
    } else {
      setLoading(prev => ({ ...prev, claude: false, github: false }))
    }

    await Promise.allSettled(requests)
  }, [isLocal, setSessions])

  useSmartPoll(loadDashboard, isLocal ? 15000 : 60000, { pauseWhenConnected: true })

  // Computed values
  const isSystemLoading = loading.system && !systemStats
  const isSessionsLoading = loading.sessions && sessions.length === 0
  const isClaudeLoading = isLocal && loading.claude && !claudeStats
  const isGithubLoading = isLocal && loading.github && !githubStats

  const memPct = systemStats?.memory?.total
    ? Math.round((systemStats.memory.used / systemStats.memory.total) * 100)
    : null

  const diskPct = parseInt(systemStats?.disk?.usage || '', 10)
  const systemLoad = Math.max(memPct ?? 0, Number.isFinite(diskPct) ? diskPct : 0)

  const activeSessions = sessions.filter((s) => s.active).length
  const errorCount = logs.filter((l) => l.level === 'error').length
  const onlineAgents = dbStats
    ? dbStats.agents.total - (dbStats.agents.byStatus?.offline ?? 0)
    : agents.filter((a) => a.status !== 'offline').length

  const claudeLocalSessions = sessions.filter((s) => s.kind === 'claude-code')
  const codexLocalSessions = sessions.filter((s) => s.kind === 'codex-cli')
  const hermesLocalSessions = sessions.filter((s) => s.kind === 'hermes')
  const claudeActive = claudeLocalSessions.filter((s) => s.active).length
  const codexActive = codexLocalSessions.filter((s) => s.active).length
  const hermesActive = hermesLocalSessions.filter((s) => s.active).length

  const runningTasks = dbStats?.tasks.byStatus?.in_progress ?? tasks.filter((t) => t.status === 'in_progress').length
  const inboxCount = dbStats?.tasks.byStatus?.inbox ?? 0
  const assignedCount = dbStats?.tasks.byStatus?.assigned ?? 0
  const reviewCount = (dbStats?.tasks.byStatus?.review ?? 0) + (dbStats?.tasks.byStatus?.quality_review ?? 0)
  const doneCount = dbStats?.tasks.byStatus?.done ?? 0
  const backlogCount = inboxCount + assignedCount + reviewCount

  const localOsStatus = isSystemLoading
    ? { value: 'Loading...', status: 'warn' as const }
    : getLocalOsStatus(memPct, Number.isFinite(diskPct) ? diskPct : null)

  const claudeHealth = isClaudeLoading
    ? { value: 'Loading...', status: 'warn' as const }
    : getProviderHealth(claudeStats?.active_sessions ?? claudeActive, claudeStats?.total_sessions ?? claudeLocalSessions.length)

  const codexHealth = isSessionsLoading
    ? { value: 'Loading...', status: 'warn' as const }
    : getProviderHealth(codexActive, codexLocalSessions.length)

  const hermesHealth = isSessionsLoading
    ? { value: 'Loading...', status: 'warn' as const }
    : getProviderHealth(hermesActive, hermesLocalSessions.length)

  const mcHealth = isSystemLoading
    ? { value: 'Loading...', status: 'warn' as const }
    : getMcHealth(systemStats, dbStats, errorCount)

  const localSessionLogs: LogLike[] = isLocal
    ? sessions.reduce<LogLike[]>((acc, session) => {
        const ts = session.lastActivity || session.startTime || 0
        if (!ts) return acc

        const lastPrompt = typeof (session as any).lastUserPrompt === 'string'
          ? (session as any).lastUserPrompt.trim()
          : ''

        acc.push({
          id: `local-session-${session.id}-${ts}`,
          timestamp: ts,
          level: 'info',
          source: session.kind === 'codex-cli' ? 'codex-local' : session.kind === 'hermes' ? 'hermes-local' : 'claude-local',
          message: lastPrompt
            ? `Prompt: ${lastPrompt}`
            : `${session.active ? 'Active' : 'Idle'} session: ${session.key || session.id}`,
        })
        return acc
      }, [])
    : []

  const mergedRecentLogs: LogLike[] = (isLocal ? [...logs, ...localSessionLogs] : logs)
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter((entry, index, arr) => arr.findIndex((x) => x.id === entry.id) === index)
    .slice(0, 10)

  const recentErrorLogs = mergedRecentLogs.filter((log) => log.level === 'error').length
  const gatewayHealthStatus = connection.isConnected ? 'good' as const : 'bad' as const

  const openSession = useCallback((session: any) => {
    const kind = String(session?.kind || '')
    const sid = String(session?.id || '')
    if (!sid) return
    setActiveConversation(`session:${kind}:${sid}`)
    navigateToPanel('chat')
  }, [setActiveConversation, navigateToPanel])

  const dashboardData: DashboardData = {
    isLocal,
    systemStats,
    dbStats,
    claudeStats,
    githubStats,
    loading,
    sessions,
    logs,
    agents,
    tasks,
    connection,
    subscription,
    navigateToPanel,
    openSession,
    memPct,
    diskPct,
    systemLoad,
    activeSessions,
    errorCount,
    onlineAgents,
    claudeActive,
    codexActive,
    hermesActive,
    claudeLocalSessions,
    codexLocalSessions,
    hermesLocalSessions,
    runningTasks,
    inboxCount,
    assignedCount,
    reviewCount,
    doneCount,
    backlogCount,
    mergedRecentLogs,
    recentErrorLogs,
    localOsStatus,
    claudeHealth,
    codexHealth,
    hermesHealth,
    mcHealth,
    gatewayHealthStatus,
    isSystemLoading,
    isSessionsLoading,
    isClaudeLoading,
    isGithubLoading,
    hermesCronJobCount,
    subscriptionLabel,
    subscriptionPrice,
  }

  return (
    <div className="p-5 space-y-4">
      <OnboardingChecklistWidget />
      <BlackwireHqOverview />
      <EmptyStateLaunchpad
        agentCount={dbStats?.agents.total ?? agents.length}
        taskCount={dbStats?.tasks.total ?? tasks.length}
        onNavigate={navigateToPanel}
      />
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-2xs uppercase tracking-[0.12em] text-muted-foreground">Overview</div>
            <h2 className="text-lg font-semibold text-foreground">
              {isLocal ? 'Local Agent Runtime' : 'Gateway Control Plane'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isLocal
                ? 'Unified visibility for Claude, Codex & Hermes local sessions, host pressure, and operator continuity.'
                : 'Gateway-first health, session routing, queue pressure, and incident response signals.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 min-w-[280px]">
            <SignalPill label="Mode" value={isLocal ? 'Local' : 'Gateway'} tone="info" />
            <SignalPill label="Events" value={`${mergedRecentLogs.length} stream`} tone={recentErrorLogs > 0 ? 'warning' : 'success'} />
            <SignalPill label="Queue" value={String(backlogCount)} tone={backlogCount > 10 ? 'warning' : 'info'} />
            <SignalPill label="Errors" value={String(errorCount)} tone={errorCount > 0 ? 'warning' : 'success'} />
          </div>
        </div>
      </section>

      <WidgetGrid data={dashboardData} />
    </div>
  )
}

interface HqSurface {
  id: string
  label: string
  status: string
  detail: string
  href?: string
}

interface HqGate {
  id: string
  label: string
  status: string
  detail: string
  requiredEvidence?: string
  blockedAction?: string
  href?: string
}

interface HqSnapshot {
  generatedAt: number
  canonical: {
    activePath: string
    sourceOfTruth: string
  }
  metrics: Record<string, number>
  surfaces: HqSurface[]
  blackwireDoneGates: HqGate[]
  truthGates: HqGate[]
  agents: Array<{ agent_id: string; display_name: string; status: string; current_assignment: string | null; last_proof: string | null }>
  assignments: Array<{ id: number; title: string; status: string; priority: string; assignee_agent_id: string | null; evidence: string | null }>
  receipts: Array<{ id: number; decision: string; approval_tier: string; approved_by: string; evidence: string | null; created_at: number }>
  queuedAlerts: Array<{ id: number; target_agent_id: string; reason: string; alert_state: string }>
}

const hqStatusClass: Record<string, string> = {
  live: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  read_only: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  partial: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  approval_required: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  evidence_missing: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  not_instrumented: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  isolated: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  blocked: 'border-red-500/30 bg-red-500/10 text-red-300',
}

function HqStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${hqStatusClass[status] || hqStatusClass.partial}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function HqMetric({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'warn' | 'bad' | 'good' }) {
  const toneClass = tone === 'bad'
    ? 'text-red-200'
    : tone === 'warn'
      ? 'text-amber-200'
      : tone === 'good'
        ? 'text-emerald-200'
        : 'text-white'
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className={`text-2xl font-black tracking-tight ${toneClass}`}>{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  )
}

function BlackwireHqOverview() {
  const [snapshot, setSnapshot] = useState<HqSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/mission-control-mvp')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load Mission Control MVP snapshot')
      setSnapshot(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => { load() }, [load])

  const metrics = snapshot?.metrics || {}
  const priorityGates = [
    ...(snapshot?.blackwireDoneGates || []),
    ...(snapshot?.truthGates || []),
  ].filter((gate) => ['blocked', 'approval_required', 'evidence_missing', 'not_instrumented'].includes(gate.status)).slice(0, 5)
  const activeAssignments = (snapshot?.assignments || []).filter((item) => item.status !== 'done').slice(0, 5)
  const operatorSurfaces = (snapshot?.surfaces || []).filter((surface) => [
    'blackwire-room',
    'assignment-boards',
    'approvals',
    'agent-registry',
    'receipts-evidence-search',
    'brain-memory',
    'research-command',
    'asset-library',
    'marketing-command-center',
  ].includes(surface.id)).slice(0, 9)

  return (
    <section className="mc-surface overflow-hidden border border-[color:var(--mc-hairline-2)] text-slate-100 shadow-2xl shadow-cyan-950/20">
      <div className="relative">
        <div className="mc-scan" />
        <div className="relative p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap gap-2">
                <Chip tone="teal" pulse>Blackwire Ops HQ</Chip>
                <Chip tone="purple">Local daily-driver</Chip>
                <Chip tone="amber">Evidence before Done</Chip>
              </div>
              <h1 className="mc-title-glitch mt-3 font-mono text-2xl font-black uppercase tracking-[0.06em] text-white md:text-3xl">Mission Control ground-zero command center</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Source-of-truth view for rooms, tasks, agents, approvals, receipts, expenses, knowledge intake, and read-only memory boundaries. This is local Mission Control proof, not a production deploy or external delivery claim.
              </p>
              <p className="mt-2 break-all text-[11px] text-slate-500">
                {snapshot?.canonical.sourceOfTruth || 'Loading Mission Control local snapshot...'} · {snapshot?.canonical.activePath || 'canonical path pending'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/command-truth"><Btn as="span" variant="primary">Command Truth</Btn></Link>
              <Link href="/group-chat"><Btn as="span">Group Chat</Btn></Link>
              <Btn onClick={load}>Refresh</Btn>
            </div>
          </div>

          {error && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

          <div className="mt-4">
            <BoundaryBanner tone="amber" title="Local mode">
              Runtime is bound to the local gateway. No external mutations, no external sends, and no provider-side state changes are claimed from this HQ screen.
            </BoundaryBanner>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Stat label="Rooms" value={metrics.rooms ?? 0} />
            <Stat label="Messages" value={metrics.messages ?? 0} />
            <Stat label="Tasks" value={metrics.assignments ?? 0} />
            <Stat label="Receipts" value={metrics.receipts ?? 0} />
            <Stat label="Agents" value={metrics.agents ?? 0} />
            <Stat label="Alerts" value={metrics.queuedAlerts ?? 0} accent={(metrics.queuedAlerts ?? 0) > 0 ? 'amber' : 'teal'} />
            <Stat label="Evidence gaps" value={metrics.doneWithoutEvidence ?? 0} accent={(metrics.doneWithoutEvidence ?? 0) > 0 ? 'rose' : 'teal'} />
            <Stat label="Approval gates" value={metrics.approvalNeededAssignments ?? 0} accent={(metrics.approvalNeededAssignments ?? 0) > 0 ? 'amber' : 'teal'} />
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[1.1fr_1fr_0.9fr]">
            <HudPanel kicker="01" title="Priority Gates" right={<Link href="/command-truth" className="font-mono text-xs font-semibold text-cyan-200 hover:underline">Open truth</Link>} glow>
              <div className="space-y-2">
                {priorityGates.length === 0 ? (
                  <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">No blocked/evidence-missing gates in the current Blackwire snapshot.</p>
                ) : priorityGates.map((gate) => (
                  <article key={gate.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-100">{gate.label}</h3>
                      <HqStatusBadge status={gate.status} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{gate.detail}</p>
                    {(gate.requiredEvidence || gate.blockedAction) && <p className="mt-2 text-xs leading-5 text-amber-100">{gate.requiredEvidence || gate.blockedAction}</p>}
                  </article>
                ))}
              </div>
            </HudPanel>

            <HudPanel kicker="02" title="Assignments Now" right={<Link href="/group-chat" className="font-mono text-xs font-semibold text-cyan-200 hover:underline">Open room</Link>}>
              <div className="space-y-2">
                {activeAssignments.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">No active Blackwire assignment rows are waiting in the selected room.</p>
                ) : activeAssignments.map((item) => (
                  <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-semibold text-slate-100">{item.title}</h3>
                      <HqStatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">@{item.assignee_agent_id || 'unassigned'} · {item.priority}</p>
                    <p className={`mt-2 rounded-lg border px-2 py-1.5 text-xs ${item.evidence ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : 'border-orange-400/20 bg-orange-400/10 text-orange-100'}`}>
                      {item.evidence ? `Evidence: ${item.evidence}` : 'Evidence Missing: cannot be green.'}
                    </p>
                  </article>
                ))}
              </div>
            </HudPanel>

            <HudPanel kicker="03" title="Daily-Driver Links">
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ['Tasks', '/tasks'],
                  ['Agents', '/agents'],
                  ['Approvals', '/exec-approvals'],
                  ['Expenses', '/expenses'],
                  ['Knowledge', '/knowledge-intake'],
                  ['Brain/Memory', '/brain-memory'],
                  ['Research', '/research-command'],
                  ['Assets', '/asset-library'],
                  ['Security', '/security-command'],
                  ['Marketing', '/marketing'],
                ].map(([label, href]) => (
                  <Link key={href} href={href} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-300/30 hover:text-cyan-100">{label}</Link>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {operatorSurfaces.slice(0, 3).map((surface) => (
                  <article key={surface.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-100">{surface.label}</span>
                      <HqStatusBadge status={surface.status} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{surface.detail}</p>
                  </article>
                ))}
              </div>
            </HudPanel>
          </div>
        </div>
      </div>
    </section>
  )
}
