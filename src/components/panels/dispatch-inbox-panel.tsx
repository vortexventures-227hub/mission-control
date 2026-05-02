'use client'

import { useState, useEffect, useCallback } from 'react'
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground">
            <InboxIcon />
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm">Dispatch</h2>
            <p className="text-xs text-muted-foreground">
              {data
                ? `${data.unprocessedCount} pending · ${data.total} total`
                : 'Loading...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">
            Updated {formatDate(lastRefresh.getTime())}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setLoading(true); fetchData() }}
            disabled={loading}
            className="h-8 text-xs"
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
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border shrink-0 overflow-x-auto">
        {(['ALL', 'NEW', 'FLAGGED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <span>{f === 'ALL' ? 'All Inbox' : f}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              filter === f ? 'bg-primary-foreground/20' : 'bg-secondary'
            }`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {loading && !data ? (
          <div className="flex items-center justify-center h-32">
            <Loader variant="inline" />
          </div>
        ) : error ? (
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
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground text-sm">Inbox is clear</p>
                    <p className="text-xs mt-1">Axis is quiet. No pending files.</p>
                  </div>
                </div>
              ) : filteredInbox.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                  <p className="text-sm">No files with status {filter}</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
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
              <div className="border-t border-border">
                <button
                  onClick={() => setProcessedExpanded(v => !v)}
                  className="flex items-center justify-between w-full px-4 py-3 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Processed
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {data.processed.length}
                    </span>
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
                  <div className="divide-y divide-border opacity-70">
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
      className={`flex items-start gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer group ${isProcessed ? 'opacity-60 hover:opacity-80' : ''}`}
      onClick={onOpen}
    >
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${config.dotColor}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground text-sm truncate">{file.name}</span>
          {file.projectTag && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
              {file.projectTag}
            </span>
          )}
          {isProcessed && file.processedAt && (
            <span className="text-xs text-muted-foreground shrink-0">
              processed {formatProcessedAt(file.processedAt)}
            </span>
          )}
          {!isProcessed && (
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${config.badgeClass}`}>
              {config.label}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{file.preview}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{formatBytes(file.size)}</span>
          <span>·</span>
          <span>{formatDate(file.modifiedMs)}</span>
          {!isProcessed && file.status === 'FLAGGED' && (
            <>
              <span>·</span>
              <span className="text-red-400">Flagged</span>
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
        className="relative z-10 flex flex-col w-full max-w-3xl max-h-[85vh] mx-4 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-2 h-2 rounded-full mt-0.5 shrink-0 ${STATUS_CONFIG[file.status].dotColor}`} />
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-sm truncate">{file.name}</h3>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.size)} · {formatDate(file.modifiedMs)}
                {file.processedAt ? ` · Processed ${formatProcessedAt(file.processedAt)}` : ''}
              </p>
            </div>
            {file.projectTag && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">
                {file.projectTag}
              </span>
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
