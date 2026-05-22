'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
import { useMissionControl } from '@/store'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('LogViewer')

const MAX_LOG_BUFFER = 1000

interface LogFilters {
  level?: string
  source?: string
  search?: string
  session?: string
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function LogViewerPanel() {
  const t = useTranslations('logViewer')
  const { logs, logFilters, setLogFilters, clearLogs, addLog } = useMissionControl()
  const [isAutoScroll, setIsAutoScroll] = useState(true)
  const [availableSources, setAvailableSources] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [logFilePath, setLogFilePath] = useState<string | null>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<boolean>(true)
  const logsRef = useRef(logs)
  const logFiltersRef = useRef(logFilters)

  const isBufferFull = logs.length >= MAX_LOG_BUFFER

  // Update ref when autoScroll state changes
  useEffect(() => {
    autoScrollRef.current = isAutoScroll
  }, [isAutoScroll])

  // Keep refs in sync so callbacks don't need `logs` / `logFilters` deps.
  useEffect(() => {
    logsRef.current = logs
  }, [logs])

  useEffect(() => {
    logFiltersRef.current = logFilters
  }, [logFilters])

  const loadLogs = useCallback(async (tail = false) => {
    log.debug(`Loading logs (tail=${tail})`)
    setIsLoading(!tail) // Only show loading for initial load, not for tailing

    try {
      const currentFilters = logFiltersRef.current
      const currentLogs = logsRef.current

      const params = new URLSearchParams({
        action: tail ? 'tail' : 'recent',
        limit: '200',
        ...(currentFilters.level && { level: currentFilters.level }),
        ...(currentFilters.source && { source: currentFilters.source }),
        ...(currentFilters.search && { search: currentFilters.search }),
        ...(currentFilters.session && { session: currentFilters.session }),
        ...(tail && currentLogs.length > 0 && { since: currentLogs[0]?.timestamp.toString() })
      })

      log.debug(`Fetching /api/logs?${params}`)
      const response = await fetch(`/api/logs?${params}`)
      const data = await response.json()

      log.debug(`Received ${data.logs?.length || 0} logs from API`)

      if (data.logs && data.logs.length > 0) {
        if (tail) {
          // Add new logs for tail mode - prepend to existing logs
          let newLogsAdded = 0
          const existingIds = new Set((currentLogs || []).map((l: any) => l?.id).filter(Boolean))
          data.logs.reverse().forEach((entry: any) => {
            if (existingIds.has(entry?.id)) return
            addLog(entry)
            newLogsAdded++
          })
          log.debug(`Added ${newLogsAdded} new logs (tail mode)`)
        } else {
          // Replace logs for initial load or refresh
          log.debug(`Clearing existing logs and loading ${data.logs.length} logs`)
          clearLogs() // Clear existing logs
          data.logs.reverse().forEach((entry: any) => {
            addLog(entry)
          })
          log.debug(`Successfully added ${data.logs.length} logs to store`)
        }
      } else {
        log.debug('No logs received from API')
      }
    } catch (error) {
      log.error('Failed to load logs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [addLog, clearLogs])

  const loadSources = useCallback(async () => {
    try {
      const response = await fetch('/api/logs?action=sources')
      const data = await response.json()
      setAvailableSources(data.sources || [])
    } catch (error) {
      log.error('Failed to load log sources:', error)
    }
  }, [])

  // Try to fetch log file path from gateway status
  const loadLogFilePath = useCallback(async () => {
    try {
      const response = await fetch('/api/status')
      const data = await response.json()
      const path = data?.config?.logFile || data?.logFile || null
      setLogFilePath(path)
    } catch {
      // Gateway may not expose this — silently ignore
    }
  }, [])

  // Load initial logs and sources
  useEffect(() => {
    log.debug('Initial load started')
    loadLogs()
    loadSources()
    loadLogFilePath()
  }, [loadLogs, loadSources, loadLogFilePath])

  // Smart polling for log tailing (10s, visibility-aware, logs mostly come via WS)
  const pollLogs = useCallback(() => {
    if (autoScrollRef.current && !isLoading) {
      loadLogs(true) // tail mode
    }
  }, [isLoading, loadLogs])

  useSmartPoll(pollLogs, 30000, { pauseWhenConnected: true })

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, isAutoScroll])

  const handleFilterChange = (newFilters: Partial<LogFilters>) => {
    setLogFilters(newFilters)
    // Reload logs with new filters
    setTimeout(() => loadLogs(), 100)
  }

  const handleScrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'text-red-400'
      case 'warn': return 'text-yellow-400'
      case 'info': return 'text-blue-400'
      case 'debug': return 'text-muted-foreground'
      default: return 'text-foreground'
    }
  }

  const getLogLevelBg = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'border-[color:var(--mc-rose)]/55 bg-[rgba(255,85,119,0.10)]'
      case 'warn': return 'border-[color:var(--mc-amber)]/55 bg-[rgba(245,165,36,0.10)]'
      case 'info': return 'border-[color:var(--mc-teal)]/35 bg-[rgba(46,230,214,0.06)]'
      case 'debug': return 'border-[color:var(--mc-hairline)] bg-black/20'
      default: return 'border-[color:var(--mc-hairline)] bg-black/20'
    }
  }

  const getLogLevelTone = (level: string): 'teal' | 'amber' | 'rose' | 'dim' => {
    switch (level.toLowerCase()) {
      case 'error': return 'rose'
      case 'warn': return 'amber'
      case 'info': return 'teal'
      default: return 'dim'
    }
  }

  const filteredLogs = logs.filter(entry => {
    if (logFilters.level && entry.level !== logFilters.level) return false
    if (logFilters.source && entry.source !== logFilters.source) return false
    if (logFilters.search && !entry.message.toLowerCase().includes(logFilters.search.toLowerCase())) return false
    if (logFilters.session && (!entry.session || !entry.session.includes(logFilters.session))) return false
    return true
  })

  const handleExportText = useCallback(() => {
    const lines = filteredLogs.map(entry => {
      const ts = new Date(entry.timestamp).toISOString()
      return `[${ts}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`
    })
    const filename = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`
    downloadFile(lines.join('\n'), filename, 'text/plain')
  }, [filteredLogs])

  const handleExportJson = useCallback(() => {
    const filename = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    downloadFile(JSON.stringify(filteredLogs, null, 2), filename, 'application/json')
  }, [filteredLogs])

  // Debug logging
  log.debug(`Store has ${logs.length} logs, filtered to ${filteredLogs.length}`)

  return (
    <Page
      kicker="Blackwire Ops / Local Runtime"
      title={t('title')}
      subtitle={
        <>
          {t('description')}
          {logFilePath && <span className="ml-3 font-mono text-xs text-[color:var(--mc-ink-2)]">{logFilePath}</span>}
        </>
      }
      badges={
        <>
          <Chip tone={isAutoScroll ? 'teal' : 'amber'} pulse={isAutoScroll}>{isAutoScroll ? 'live tail' : 'manual tail'}</Chip>
          <Chip tone={isBufferFull ? 'amber' : 'dim'}>{logs.length}/{MAX_LOG_BUFFER} buffer</Chip>
          <Chip tone="dim">{availableSources.length} sources</Chip>
        </>
      }
    >
      <div className="flex min-h-[calc(100vh-12rem)] flex-col space-y-4">
        <BoundaryBanner tone="amber" title="Log boundary">
          This surface tails local Mission Control logs and clears the browser buffer only. It does not mutate log files, rotate infrastructure logs, or hide runtime failures.
        </BoundaryBanner>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Stat label="Showing" value={filteredLogs.length} sub={`${logs.length} total`} />
          <Stat label="Sources" value={availableSources.length} sub={logFilters.source || 'all sources'} accent="purple" />
          <Stat label="Auto Scroll" value={isAutoScroll ? 'ON' : 'OFF'} sub="tail mode" accent={isAutoScroll ? 'teal' : 'amber'} glow={isAutoScroll} />
          <Stat label="Buffer" value={`${Math.round((logs.length / MAX_LOG_BUFFER) * 100)}%`} sub={`${MAX_LOG_BUFFER} max`} accent={isBufferFull ? 'amber' : 'dim'} />
          <Stat label="Updated" value={logs.length > 0 ? new Date(logs[0]?.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'} sub={logs.length > 0 ? 'latest event' : t('never')} />
        </section>

        <HudPanel kicker="tail controls" title="Filters / Export" glow>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <div>
              <label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">
                {t('filterLevel')}
              </label>
            <select
              value={logFilters.level || ''}
              onChange={(e) => handleFilterChange({ level: e.target.value || undefined })}
              className="w-full border border-[color:var(--mc-hairline)] bg-black/25 px-3 py-2 font-mono text-xs text-[color:var(--mc-ink-0)] outline-none focus:border-[color:var(--mc-teal)]/70"
            >
              <option value="">{t('allLevels')}</option>
              <option value="error">{t('levelError')}</option>
              <option value="warn">{t('levelWarning')}</option>
              <option value="info">{t('levelInfo')}</option>
              <option value="debug">{t('levelDebug')}</option>
            </select>
            </div>

            <div>
              <label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">
                {t('filterSource')}
              </label>
            <select
              value={logFilters.source || ''}
              onChange={(e) => handleFilterChange({ source: e.target.value || undefined })}
              className="w-full border border-[color:var(--mc-hairline)] bg-black/25 px-3 py-2 font-mono text-xs text-[color:var(--mc-ink-0)] outline-none focus:border-[color:var(--mc-teal)]/70"
            >
              <option value="">{t('allSources')}</option>
              {availableSources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
            </div>

            <div>
              <label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">
                {t('filterSession')}
              </label>
            <input
              type="text"
              value={logFilters.session || ''}
              onChange={(e) => handleFilterChange({ session: e.target.value || undefined })}
              placeholder={t('sessionPlaceholder')}
              className="w-full border border-[color:var(--mc-hairline)] bg-black/25 px-3 py-2 font-mono text-xs text-[color:var(--mc-ink-0)] placeholder:text-[color:var(--mc-ink-3)] outline-none focus:border-[color:var(--mc-teal)]/70"
            />
            </div>

            <div>
              <label className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">
                {t('filterSearch')}
              </label>
            <input
              type="text"
              value={logFilters.search || ''}
              onChange={(e) => handleFilterChange({ search: e.target.value || undefined })}
              placeholder={t('searchPlaceholder')}
              className="w-full border border-[color:var(--mc-hairline)] bg-black/25 px-3 py-2 font-mono text-xs text-[color:var(--mc-ink-0)] placeholder:text-[color:var(--mc-ink-3)] outline-none focus:border-[color:var(--mc-teal)]/70"
            />
            </div>

            <div className="flex items-end gap-2">
            <Button
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              variant={isAutoScroll ? 'success' : 'outline'}
              size="sm"
            >
              {isAutoScroll ? t('auto') : t('manual')}
            </Button>
            <Button
              onClick={handleScrollToBottom}
              size="sm"
              className="bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
            >
              {t('bottom')}
            </Button>
            </div>

            <div className="flex items-end gap-2">
            <Button
              onClick={handleExportText}
              disabled={filteredLogs.length === 0}
              size="sm"
              className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {t('exportLog')}
            </Button>
            <Button
              onClick={handleExportJson}
              disabled={filteredLogs.length === 0}
              size="sm"
              className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {t('exportJson')}
            </Button>
            <Button
              onClick={clearLogs}
              variant="destructive"
              size="sm"
            >
              {t('clear')}
            </Button>
            </div>
          </div>
        </HudPanel>

        <div className="flex items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--mc-ink-2)]">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="neutral">{t('showing', { filtered: filteredLogs.length, total: logs.length })}</Chip>
          {isBufferFull && (
              <Chip tone="amber">{t('bufferFull', { max: MAX_LOG_BUFFER })}</Chip>
          )}
          </div>
          <div className="text-right">
            {t('autoScroll')}: {isAutoScroll ? t('on') : t('off')} / {t('lastUpdated')}: {logs.length > 0 ? new Date(logs[0]?.timestamp).toLocaleTimeString() : t('never')}
          </div>
        </div>

        <HudPanel kicker="local stream" title="Log Tail" className="flex-1" padded={false}>
        <div 
          ref={logContainerRef}
            className="max-h-[54vh] min-h-[420px] overflow-auto p-3 space-y-2 font-mono text-xs"
        >
          {isLoading ? (
            <Loader variant="panel" label="Loading logs" />
          ) : filteredLogs.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-[color:var(--mc-ink-2)]">
              {t('noLogs')}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div 
                key={log.id} 
                  className={`border-l-2 px-3 py-2 ${getLogLevelBg(log.level)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
                        <span className="text-[color:var(--mc-ink-2)]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                        <Chip tone={getLogLevelTone(log.level)}>{log.level}</Chip>
                        <span className="text-[color:var(--mc-ink-2)]">
                        [{log.source}]
                      </span>
                      {log.session && (
                          <span className="text-[color:var(--mc-ink-2)]">
                          session:{log.session}
                        </span>
                      )}
                    </div>
                      <div className={`mt-2 break-words leading-5 ${getLogLevelColor(log.level)}`}>
                      {log.message}
                    </div>
                    {log.data && (
                      <details className="mt-2">
                          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.12em] text-[color:var(--mc-ink-2)] hover:text-[color:var(--mc-ink-0)]">
                          {t('additionalData')}
                        </summary>
                          <pre className="mt-1 overflow-auto border border-[color:var(--mc-hairline)] bg-black/25 p-2 text-[10px] text-[color:var(--mc-ink-2)]">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        </HudPanel>
      </div>
    </Page>
  )
}
