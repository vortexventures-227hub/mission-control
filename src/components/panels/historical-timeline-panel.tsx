'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
import { useMissionControl } from '@/store'

interface DailyNote {
  date: string
  filename: string
  summary: string
  preview: string
  wordCount: number
  projects: string[]
  hasProjectStatus: boolean
}

interface ProjectHistory {
  name: string
  status: string
  phases: string[]
  lastModified: string | null
  hasRoadmap: boolean
  preview: string | null
}

interface SessionEntry {
  id: string
  key: string
  agent: string
  kind: string
  model: string
  startTime: number | null
  lastActivity: number | null
  status: string
  tokens: number
  messages: number
  active: boolean
}

type TimelineView = 'overview' | 'daily' | 'projects'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return formatShortDate(dateStr)
}

function formatTime(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('complete') || s.includes('done') || s.includes('stable')) return 'text-green-400'
  if (s.includes('blocked') || s.includes('error') || s.includes('fail')) return 'text-red-400'
  if (s.includes('progress') || s.includes('active') || s.includes('running')) return 'text-blue-400'
  if (s.includes('standby') || s.includes('hold') || s.includes('pause')) return 'text-yellow-400'
  return 'text-muted-foreground'
}

function getProjectEmoji(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('appfactory') || n.includes('app factory')) return '🏭'
  if (n.includes('material')) return '🏗️'
  if (n.includes('gekko')) return '🤖'
  if (n.includes('mission')) return '🎯'
  if (n.includes('karpathia')) return '🧬'
  if (n.includes('calorie')) return '🍎'
  if (n.includes('habit')) return '✅'
  if (n.includes('mood')) return '💜'
  if (n.includes('notes')) return '📝'
  if (n.includes('focus')) return '🎯'
  return '📁'
}

// ── Date Navigation Bar ─────────────────────────────
function DateNavBar({
  selectedDate,
  onSelect,
  dateRange,
}: {
  selectedDate: string
  onSelect: (date: string) => void
  dateRange: string[]
}) {
  const currentIndex = dateRange.indexOf(selectedDate)
  const canGoPrev = currentIndex < dateRange.length - 1
  const canGoNext = currentIndex > 0

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => canGoPrev && onSelect(dateRange[currentIndex + 1])}
        disabled={!canGoPrev}
        className="text-muted-foreground"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>

      <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] scrollbar-hide">
        {dateRange.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map(date => (
          <button
            key={date}
            onClick={() => onSelect(date)}
            className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors ${
              date === selectedDate
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            {formatShortDate(date)}
          </button>
        ))}
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => canGoNext && onSelect(dateRange[currentIndex - 1])}
        disabled={!canGoNext}
        className="text-muted-foreground"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>
    </div>
  )
}

// ── Calendar Picker ─────────────────────────────────
function CalendarPicker({
  selectedDate,
  availableDates,
  onSelect,
}: {
  selectedDate: string
  availableDates: Set<string>
  onSelect: (date: string) => void
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const [y, m] = selectedDate.split('-')
    return { year: parseInt(y), month: parseInt(m) }
  })

  const today = new Date().toISOString().split('T')[0]

  const daysInMonth = new Date(viewMonth.year, viewMonth.month, 0).getDate()
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month - 1, 1).getDay()

  const weeks: (string | null)[][] = []
  let currentWeek: (string | null)[] = Array(firstDayOfWeek).fill(null)

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    currentWeek.push(dateStr)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null)
    weeks.push(currentWeek)
  }

  const monthName = new Date(viewMonth.year, viewMonth.month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    setViewMonth(prev => {
      if (prev.month === 1) return { year: prev.year - 1, month: 12 }
      return { ...prev, month: prev.month - 1 }
    })
  }

  const nextMonth = () => {
    setViewMonth(prev => {
      if (prev.month === 12) return { year: prev.year + 1, month: 1 }
      return { ...prev, month: prev.month + 1 }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 w-64">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon-sm" onClick={prevMonth} className="text-muted-foreground">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
        <span className="text-xs font-semibold text-foreground">{monthName}</span>
        <Button variant="ghost" size="icon-sm" onClick={nextMonth} className="text-muted-foreground">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {weeks.flat().filter(Boolean).map((dateStr, idx) => {
          if (!dateStr) return <div key={`empty-${idx}`} />
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === today
          const hasNote = availableDates.has(dateStr)

          return (
            <button
              key={dateStr}
              onClick={() => onSelect(dateStr)}
              className={`
                relative w-7 h-7 rounded text-xs flex items-center justify-center transition-colors
                ${isSelected ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-secondary text-foreground'}
                ${isToday && !isSelected ? 'ring-1 ring-primary/50' : ''}
              `}
            >
              {dateStr.split('-')[2].replace(/^0/, '')}
              {hasNote && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Daily Notes View ────────────────────────────────
function DailyNotesView({
  selectedDate,
  notes,
  sessions,
  onDateSelect,
  dateRange,
}: {
  selectedDate: string
  notes: DailyNote[]
  sessions: SessionEntry[]
  onDateSelect: (date: string) => void
  dateRange: string[]
}) {
  const note = notes.find(n => n.date === selectedDate)
  const dateSessions = sessions.filter(s => {
    if (!s.lastActivity) return false
    const sessionDate = new Date(s.lastActivity).toISOString().split('T')[0]
    return sessionDate === selectedDate
  })

  return (
    <div className="grid lg:grid-cols-3 gap-4 h-full">
      {/* Left: Date list */}
      <div className="lg:col-span-1 space-y-1 overflow-y-auto max-h-[600px] pr-1">
        <div className="mb-3">
          <DateNavBar selectedDate={selectedDate} onSelect={onDateSelect} dateRange={dateRange} />
        </div>
        {notes.slice(0, 30).map(n => (
          <button
            key={n.date}
            onClick={() => onDateSelect(n.date)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              n.date === selectedDate
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-border/80 hover:bg-secondary/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-foreground">{formatShortDate(n.date)}</span>
              {n.hasProjectStatus && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{n.summary}</p>
            {n.projects.length > 0 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {n.projects.slice(0, 3).map(p => (
                  <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Right: Content */}
      <div className="lg:col-span-2 space-y-4 overflow-y-auto max-h-[600px]">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{formatDate(selectedDate)}</h3>
          {note ? (
            <p className="text-xs text-muted-foreground">{note.wordCount} words</p>
          ) : (
            <p className="text-xs text-muted-foreground/50">No daily note for this date</p>
          )}
        </div>

        {/* Sessions for this date */}
        {dateSessions.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v3l2 2" strokeLinecap="round" />
              </svg>
              Sessions on {formatShortDate(selectedDate)}
            </h4>
            <div className="space-y-2">
              {dateSessions.map(session => (
                <div key={session.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/30 transition-colors">
                  <div className={`w-2 h-2 rounded-full ${session.active ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground truncate">{session.agent || session.kind}</span>
                      <span className="text-[10px] text-muted-foreground">{session.model}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {session.messages} msgs · {session.tokens.toLocaleString()} tokens
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono-tight">
                    {formatTime(session.lastActivity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note content */}
        {note && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="text-xs font-semibold text-foreground mb-3">Daily Log</h4>
            <div className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed font-mono-tight bg-secondary/30 rounded p-3 max-h-64 overflow-y-auto">
              {note.preview}
            </div>
          </div>
        )}

        {!note && dateSessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
            <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" className="mb-3">
              <path d="M2 4h12M2 8h8M2 12h10" strokeLinecap="round" />
            </svg>
            <p className="text-sm">Nothing recorded on {formatShortDate(selectedDate)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Projects Timeline View ──────────────────────────
function ProjectsTimelineView({ projects }: { projects: ProjectHistory[] }) {
  return (
    <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
      {projects.map(project => (
        <div key={project.name} className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{getProjectEmoji(project.name)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-foreground">{project.name}</h4>
                <span className={`text-[10px] font-medium ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>

              {project.phases.length > 0 && (
                <div className="flex gap-1 mb-2 flex-wrap">
                  {project.phases.map(phase => (
                    <span key={phase} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
                      Phase {phase}
                    </span>
                  ))}
                </div>
              )}

              {project.preview && (
                <div className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-3 font-mono-tight bg-secondary/30 rounded p-2">
                  {project.preview}
                </div>
              )}

              {project.lastModified && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Last updated: {new Date(project.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
          <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" className="mb-3">
            <rect x="2" y="2" width="12" height="12" rx="2" />
            <path d="M5 8h6M5 5h6M5 11h3" strokeLinecap="round" />
          </svg>
          <p className="text-sm">No project roadmaps found</p>
        </div>
      )}
    </div>
  )
}

// ── Overview / Timeline Strip ────────────────────────
function TimelineStrip({
  notes,
  selectedDate,
  onDateSelect,
}: {
  notes: DailyNote[]
  selectedDate: string
  onDateSelect: (date: string) => void
}) {
  const recentNotes = notes.slice(0, 14)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Days</h3>
        <span className="text-[10px] text-muted-foreground">{notes.length} days logged</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {recentNotes.map(note => (
          <button
            key={note.date}
            onClick={() => onDateSelect(note.date)}
            className={`flex-shrink-0 flex flex-col items-center p-2 rounded-lg border transition-all min-w-[60px] ${
              note.date === selectedDate
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <span className="text-[10px] text-muted-foreground font-medium">
              {new Date(note.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
            <span className="text-lg font-bold text-foreground">{note.date.split('-')[2].replace(/^0/, '')}</span>
            <span className="text-[10px] text-muted-foreground">{note.date.split('-')[1]}/{note.date.split('-')[0].slice(2)}</span>
            {note.hasProjectStatus && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────
export function HistoricalTimelinePanel() {
  const { agents } = useMissionControl()

  const [view, setView] = useState<TimelineView>('overview')
  const [notes, setNotes] = useState<DailyNote[]>([])
  const [projects, setProjects] = useState<ProjectHistory[]>([])
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())

  const dateRange = notes.map(n => n.date)

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/history/daily-notes?limit=90')
      if (!res.ok) return
      const data = await res.json()
      setNotes(data.notes || [])
      setAvailableDates(new Set((data.notes || []).map((n: DailyNote) => n.date)))
    } catch { /* silent */ }
  }, [])

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/history/projects')
      if (!res.ok) return
      const data = await res.json()
      setProjects(data.projects || [])
    } catch { /* silent */ }
  }, [])

  // Fetch sessions (last 30 days)
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/history/sessions?limit=200')
      if (!res.ok) return
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([fetchNotes(), fetchProjects(), fetchSessions()]).finally(() => setLoading(false))
  }, [fetchNotes, fetchProjects, fetchSessions])

  // Set selected date to most recent note
  useEffect(() => {
    if (notes.length > 0 && !selectedDate) {
      setSelectedDate(notes[0].date)
    }
  }, [notes, selectedDate])

  const noteCount = notes.length
  const projectCount = projects.length
  const sessionCount = sessions.length

  if (loading && notes.length === 0) {
    return (
      <Page title="Historical Timeline" kicker="Blackwire Ops / History" subtitle="Loading day notes, project milestones, and session history.">
        <HudPanel>
          <div className="flex h-64 items-center justify-center">
            <Loader variant="inline" label="Loading timeline..." />
          </div>
        </HudPanel>
      </Page>
    )
  }

  return (
    <Page
      kicker="Blackwire Ops / History"
      title="Historical Timeline"
      subtitle="Day-grouped notes, project milestones, and session history for operator recall. This is read-only historical context, not a status source of truth."
      badges={
        <>
          <Chip tone="teal">read only</Chip>
          <Chip tone="dim">{noteCount} days</Chip>
          <Chip tone="dim">{projectCount} projects</Chip>
          <Chip tone="dim">{sessionCount} sessions</Chip>
        </>
      }
    >
      <div className="space-y-4">
        <BoundaryBanner tone="teal" title="History boundary">
          Timeline entries are loaded from local daily notes, project summaries, and recorded sessions. They help reconstruct context but do not mark current work verified without a receipt.
        </BoundaryBanner>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="Days Logged" value={noteCount} sub="daily notes" />
          <Stat label="Projects" value={projectCount} sub="tracked history" accent="purple" />
          <Stat label="Sessions" value={sessionCount} sub={`${agents.length} agents known`} accent="teal" />
          <Stat label="View" value={view.toUpperCase()} sub="timeline mode" accent="amber" glow />
        </section>

        <HudPanel
          kicker="timeline controls"
          title="History View"
          right={
            <div className="flex gap-1 border border-[color:var(--mc-hairline)] bg-black/20 p-1">
            {([
              ['overview', 'Overview'],
              ['daily', 'Daily'],
              ['projects', 'Projects'],
            ] as [TimelineView, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                    className={`px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                      view === v ? 'bg-[rgba(46,230,214,0.16)] text-[color:var(--mc-teal)]' : 'text-[color:var(--mc-ink-2)] hover:text-[color:var(--mc-ink-0)]'
                }`}
              >
                {label}
              </button>
            ))}
            </div>
          }
          padded={false}
          glow
        >

      {/* Content */}
          <div className="max-h-[calc(100vh-22rem)] min-h-[520px] overflow-hidden p-4">
        {view === 'overview' && (
          <div className="space-y-6 h-full overflow-y-auto">
            <TimelineStrip notes={notes} selectedDate={selectedDate} onDateSelect={d => { setSelectedDate(d); setView('daily') }} />

            {/* Recent activity summary */}
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Top projects by recent activity */}
                  <HudPanel kicker="recent" title="Projects Active Recently">
                <div className="space-y-2">
                  {projects.slice(0, 6).map(p => (
                    <div key={p.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{getProjectEmoji(p.name)}</span>
                        <span className="text-xs font-medium text-foreground">{p.name}</span>
                      </div>
                      <span className={`text-[10px] font-medium ${getStatusColor(p.status)}`}>{p.status}</span>
                    </div>
                  ))}
                </div>
                  </HudPanel>

              {/* Active sessions summary */}
                  <HudPanel kicker="recent" title="Sessions">
                <div className="space-y-2">
                  {sessions.slice(0, 6).map(s => (
                    <div key={s.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${s.active ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                        <span className="text-xs font-medium text-foreground">{s.agent || s.kind}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {s.lastActivity ? formatRelativeDate(new Date(s.lastActivity).toISOString().split('T')[0]) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                  </HudPanel>
            </div>
          </div>
        )}

        {view === 'daily' && (
          <DailyNotesView
            selectedDate={selectedDate}
            notes={notes}
            sessions={sessions}
            onDateSelect={setSelectedDate}
            dateRange={dateRange}
          />
        )}

        {view === 'projects' && (
          <ProjectsTimelineView projects={projects} />
        )}
          </div>
        </HudPanel>
      </div>
    </Page>
  )
}
