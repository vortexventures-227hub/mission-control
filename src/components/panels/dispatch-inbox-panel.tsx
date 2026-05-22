'use client'

import { useState, useEffect, useCallback } from 'react'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { MarkdownRenderer } from '@/components/markdown-renderer'

type FileStatus = 'NEW' | 'PROCESSED' | 'FLAGGED'

interface InboxFile {
  name: string
  path: string
  size: number
  modifiedMs: number
  status: FileStatus
  preview: string
  projectTag: string | null
  processedAt?: number
}

interface InboxResponse {
  inbox: InboxFile[]
  processed: InboxFile[]
  total: number
  unprocessedCount: number
}

const STATUS_CONFIG: Record<FileStatus, { label: string; dotColor: string; badgeClass: string }> = {
  NEW: {
    label: 'New',
    dotColor: 'bg-blue-400',
    badgeClass: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  },
  PROCESSED: {
    label: 'Processed',
    dotColor: 'bg-green-400',
    badgeClass: 'bg-green-500/20 text-green-400 border border-green-500/30',
  },
  FLAGGED: {
    label: 'Flagged',
    dotColor: 'bg-red-400',
    badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/30',
  },
}

function statusTone(status: FileStatus): 'teal' | 'amber' | 'rose' | 'neutral' {
  if (status === 'PROCESSED') return 'teal'
  if (status === 'FLAGGED') return 'rose'
  return 'amber'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatDate(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const diff = now.getTime() - ms
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function formatProcessedAt(ms?: number): string {
  if (!ms) return 'Unknown'
  const d = new Date(ms)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function isMarkdown(name: string): boolean {
  return /\.(md|mdx|txt)$/i.test(name)
}

function InboxIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 0 0 1.183 1.981l6.478 3.488m8.839 2.51-4.66-2.51m0 0-1.023-.55a2.25 2.25 0 0 0-2.134 0l-1.022.55m0 0-4.661 2.51m16.5 1.615a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V8.844a2.25 2.25 0 0 1 1.183-1.981l7.5-4.039a2.25 2.25 0 0 1 2.134 0l7.5 4.039a2.25 2.25 0 0 1 1.183 1.98V19.5Z" />
    </svg>
  )
}

export function DispatchInboxPanel() {
  const [data, setData] = useState<InboxResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FileStatus | 'ALL'>('ALL')
  const [selectedFile, setSelectedFile] = useState<InboxFile | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [processedExpanded, setProcessedExpanded] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/dispatch/inbox')
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch')
      const json: InboxResponse = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  async function openFile(file: InboxFile) {
    setSelectedFile(file)
    setLoadingContent(true)
    setFileContent(null)
    try {
      const res = await fetch(`/api/dispatch/inbox?file=${encodeURIComponent(file.name)}`)
      const json = await res.json()
      setFileContent(json.content || 'Unable to read file content.')
    } catch {
      setFileContent('Failed to load file content.')
    } finally {
      setLoadingContent(false)
    }
  }

  async function updateFile(name: string, action: 'flag' | 'unflag' | 'process' | 'unprocess') {
    setUpdating(prev => ({ ...prev, [name]: true }))
    try {
      const res = await fetch('/api/dispatch/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, action }),
      })
      if (!res.ok) throw new Error('Update failed')
      await fetchData()
      if (selectedFile?.name === name) setSelectedFile(null)
    } catch (e) {
      console.error(e)
    } finally {
      setUpdating(prev => ({ ...prev, [name]: false }))
    }
  }

  // Filter inbox files
  const filteredInbox = filter === 'ALL'
    ? data?.inbox ?? []
    : data?.inbox.filter(f => f.status === filter) ?? []

  const counts = {
    ALL: data?.inbox.length ?? 0,
    NEW: data?.inbox.filter(f => f.status === 'NEW').length ?? 0,
    FLAGGED: data?.inbox.filter(f => f.status === 'FLAGGED').length ?? 0,
    PROCESSED: data?.processed.length ?? 0,
  }

  if (loading && !data) {
    return (
      <Page
        kicker="Blackwire Ops / Dispatch"
        title="Dispatch Inbox"
        subtitle="Loading the local mailbox control surface."
        badges={<Chip tone="dim">local mailbox</Chip>}
      >
        <HudPanel kicker="boot" title="Loading Dispatch">
          <Loader variant="panel" label="Loading Dispatch..." />
        </HudPanel>
      </Page>
    )
  }

  return (
    <Page
      kicker="Blackwire Ops / Dispatch"
      title="Dispatch Inbox"
      subtitle={`${data?.unprocessedCount ?? 0} pending packet(s), ${data?.total ?? 0} total. Local triage for handoffs, receipts, and blocker packets without bulk-loading raw folders.`}
      badges={
        <>
          <Chip tone="teal" pulse>local mailbox</Chip>
          <Chip tone="amber">triage only</Chip>
          <Chip tone={counts.FLAGGED > 0 ? 'rose' : 'neutral'}>{counts.FLAGGED} flagged</Chip>
        </>
      }
      actions={
        <div className="flex items-center gap-2">
          <Chip tone="dim">updated {formatDate(lastRefresh.getTime())}</Chip>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setLoading(true); fetchData() }}
            disabled={loading}
            className="h-8 font-mono text-[10px] uppercase tracking-[0.14em]"
          >
            {loading ? (
              <Loader variant="inline" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            )}
            <span className="ml-1.5">Refresh</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <BoundaryBanner tone="amber" title="Dispatch Boundary">
          This surface reads and triages the local Dispatch inbox. It does not bulk-load raw mailbox folders,
          send external messages, or claim packets done without matching receipts.
        </BoundaryBanner>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="pending" value={data?.unprocessedCount ?? 0} sub="needs operator triage" glow accent="amber" />
          <Stat label="new" value={counts.NEW} sub="fresh inbox" accent="amber" />
          <Stat label="flagged" value={counts.FLAGGED} sub={counts.FLAGGED > 0 ? 'attention' : 'clear'} accent={counts.FLAGGED > 0 ? 'rose' : 'dim'} />
          <Stat label="processed" value={counts.PROCESSED} sub="receipt trail" accent="teal" />
        </div>

        <HudPanel
          kicker="filters"
          title="Inbox Scope"
          right={<Chip tone="neutral">total {data?.total ?? 0}</Chip>}
        >
          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'NEW', 'FLAGGED'] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-2 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  filter === f
                    ? 'border-[color:var(--mc-teal)]/70 bg-[rgba(46,230,214,0.14)] text-[color:var(--mc-teal-soft)]'
                    : 'border-[color:var(--mc-hairline-2)] bg-white/[0.035] text-[color:var(--mc-ink-2)] hover:border-[color:var(--mc-teal)]/45 hover:text-[color:var(--mc-ink-0)]'
                }`}
              >
                <span>{f === 'ALL' ? 'All Inbox' : f}</span>
                <span>{counts[f]}</span>
              </button>
            ))}
          </div>
        </HudPanel>

      {/* Main content */}
        <HudPanel kicker="packets" title="Dispatch Queue" padded={false}>
      <div className="overflow-y-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-destructive">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* INBOX section */}
            <div>
              {filteredInbox.length === 0 && data?.inbox.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-[color:var(--mc-ink-2)]">
                  <div className="grid h-12 w-12 place-items-center border border-[color:var(--mc-hairline-2)] bg-white/[0.035]">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-sm font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-0)]">Inbox is clear</p>
                    <p className="text-xs mt-1">Axis is quiet. No pending files.</p>
                  </div>
                </div>
              ) : filteredInbox.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                  <p className="text-sm">No files with status {filter}</p>
                </div>
              ) : (
                <div className="divide-y divide-[color:var(--mc-hairline)]">
                  {filteredInbox.map(file => (
                    <FileRow
                      key={file.path}
                      file={file}
                      onOpen={() => openFile(file)}
                      onFlag={() => updateFile(file.name, 'flag')}
                      onUnflag={() => updateFile(file.name, 'unflag')}
                      onProcess={() => updateFile(file.name, 'process')}
                      onUnprocess={() => updateFile(file.name, 'unprocess')}
                      isUpdating={updating[file.name] ?? false}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* PROCESSED section */}
            {data && data.processed.length > 0 && (
              <div className="border-t border-[color:var(--mc-hairline)]">
                <button
                  onClick={() => setProcessedExpanded(v => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-[rgba(46,230,214,0.045)]"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">
                      Processed
                    </span>
                    <Chip tone="teal">{data.processed.length}</Chip>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`w-4 h-4 text-muted-foreground transition-transform ${processedExpanded ? 'rotate-180' : ''}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                  </svg>
                </button>

                {processedExpanded && (
                  <div className="divide-y divide-[color:var(--mc-hairline)] opacity-70">
                    {data.processed.map(file => (
                      <FileRow
                        key={file.path}
                        file={file}
                        isProcessed
                        onOpen={() => openFile(file)}
                        onFlag={() => updateFile(file.name, 'flag')}
                        onUnflag={() => updateFile(file.name, 'unflag')}
                        onProcess={() => updateFile(file.name, 'process')}
                        onUnprocess={() => updateFile(file.name, 'unprocess')}
                        isUpdating={updating[file.name] ?? false}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
        </HudPanel>

      {/* File detail modal */}
      {selectedFile && (
        <FileModal
          file={selectedFile}
          content={fileContent}
          loading={loadingContent}
          onClose={() => setSelectedFile(null)}
          onFlag={() => updateFile(selectedFile.name, 'flag')}
          onUnflag={() => updateFile(selectedFile.name, 'unflag')}
          onProcess={() => updateFile(selectedFile.name, 'process')}
          onUnprocess={() => updateFile(selectedFile.name, 'unprocess')}
        />
      )}
      </div>
    </Page>
  )
}

// ─── File Row ────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: InboxFile
  isProcessed?: boolean
  isUpdating: boolean
  onOpen: () => void
  onFlag: () => void
  onUnflag: () => void
  onProcess: () => void
  onUnprocess: () => void
}

function FileRow({ file, isProcessed, isUpdating, onOpen, onFlag, onUnflag, onProcess, onUnprocess }: FileRowProps) {
  const config = STATUS_CONFIG[file.status]

  return (
    <div
      className={`group flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-[rgba(46,230,214,0.045)] ${isProcessed ? 'opacity-60 hover:opacity-80' : ''}`}
      onClick={onOpen}
    >
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${config.dotColor}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="truncate font-mono text-sm font-black text-[color:var(--mc-ink-0)]">{file.name}</span>
          {file.projectTag && (
            <Chip tone="purple">{file.projectTag}</Chip>
          )}
          {isProcessed && file.processedAt && (
            <span className="text-xs text-muted-foreground shrink-0">
              processed {formatProcessedAt(file.processedAt)}
            </span>
          )}
          {!isProcessed && (
            <Chip tone={statusTone(file.status)}>{config.label}</Chip>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-[color:var(--mc-ink-2)]">{file.preview}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-[color:var(--mc-ink-2)]">
          <span>{formatBytes(file.size)}</span>
          <span>·</span>
          <span>{formatDate(file.modifiedMs)}</span>
          {!isProcessed && file.status === 'FLAGGED' && (
            <>
              <span>·</span>
              <span className="text-[color:var(--mc-rose)]">Flagged</span>
            </>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
        {isProcessed ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
            onClick={onUnprocess}
            disabled={isUpdating}
            title="Move back to inbox"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
          </Button>
        ) : (
          <>
            {file.status !== 'FLAGGED' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={onFlag}
                disabled={isUpdating}
                title="Flag"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5m0 5.97 7.348-4.355a1 1 0 0 1 1.304 1.356L3 10.47V21h16l-1.667-5.667a1 1 0 0 0-1.304-1.356L21 10.47V3" />
                </svg>
              </Button>
            )}
            {file.status === 'FLAGGED' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                onClick={onUnflag}
                disabled={isUpdating}
                title="Unflag"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5m0 5.97 7.348-4.355a1 1 0 0 1 1.304 1.356L3 10.47V21h16l-1.667-5.667a1 1 0 0 0-1.304-1.356L21 10.47V3" />
                </svg>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10"
              onClick={onProcess}
              disabled={isUpdating}
              title="Mark Processed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── File Modal ─────────────────────────────────────────────────────────────

interface FileModalProps {
  file: InboxFile
  content: string | null
  loading: boolean
  onClose: () => void
  onFlag: () => void
  onUnflag: () => void
  onProcess: () => void
  onUnprocess: () => void
}

function FileModal({ file, content, loading, onClose, onFlag, onUnflag, onProcess, onUnprocess }: FileModalProps) {
  const isProcessed = file.status === 'PROCESSED' || file.processedAt !== undefined
  const isFlagged = file.status === 'FLAGGED'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="mc-bevel relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden bg-[color:var(--mc-bg-2)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-[color:var(--mc-hairline)] px-5 py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-2 h-2 rounded-full mt-0.5 shrink-0 ${STATUS_CONFIG[file.status].dotColor}`} />
            <div className="min-w-0">
              <h3 className="truncate font-mono text-sm font-black text-[color:var(--mc-ink-0)]">{file.name}</h3>
              <p className="text-xs text-[color:var(--mc-ink-2)]">
                {formatBytes(file.size)} · {formatDate(file.modifiedMs)}
                {file.processedAt ? ` · Processed ${formatProcessedAt(file.processedAt)}` : ''}
              </p>
            </div>
            {file.projectTag && (
              <Chip tone="purple">{file.projectTag}</Chip>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Status actions */}
            <div className="flex items-center gap-1 mr-2" onClick={e => e.stopPropagation()}>
              {isFlagged ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  onClick={onUnflag}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5m0 5.97 7.348-4.355a1 1 0 0 1 1.304 1.356L3 10.47V21h16l-1.667-5.667a1 1 0 0 0-1.304-1.356L21 10.47V3" />
                  </svg>
                  Unflag
                </Button>
              ) : !isProcessed ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={onFlag}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5m0 5.97 7.348-4.355a1 1 0 0 1 1.304 1.356L3 10.47V21h16l-1.667-5.667a1 1 0 0 0-1.304-1.356L21 10.47V3" />
                  </svg>
                  Flag
                </Button>
              ) : null}

              {isProcessed ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  onClick={onUnprocess}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                  </svg>
                  Return to Inbox
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                  onClick={onProcess}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Processed
                </Button>
              )}
            </div>

            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Modal content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4">
            <BoundaryBanner tone="amber" title="Packet Boundary">
              File actions update local Dispatch triage state only. Done claims still need an external receipt in the matching workstream.
            </BoundaryBanner>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader variant="inline" />
            </div>
          ) : content ? (
            isMarkdown(file.name) ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <MarkdownRenderer content={content} />
              </div>
            ) : (
              <pre className="text-xs text-foreground/80 font-mono whitespace-pre-wrap break-words leading-relaxed">
                {content}
              </pre>
            )
          ) : (
            <p className="text-sm text-muted-foreground">No content available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
