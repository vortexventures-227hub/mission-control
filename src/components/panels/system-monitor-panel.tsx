'use client'

import type { ReactNode } from 'react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

interface CpuData {
  usagePercent: number
  cores: number
  model: string
  loadAvg: [number, number, number]
}

interface MemoryData {
  totalBytes: number
  usedBytes: number
  availableBytes: number
  usagePercent: number
  swapTotalBytes: number
  swapUsedBytes: number
}

interface DiskData {
  mountpoint: string
  totalBytes: number
  usedBytes: number
  availableBytes: number
  usagePercent: number
}

interface GpuData {
  name: string
  memoryTotalMB: number
  memoryUsedMB: number
  usagePercent: number
}

interface NetworkData {
  interface: string
  rxBytes: number
  txBytes: number
}

interface ProcessData {
  pid: number
  name: string
  cpuPercent: number
  memPercent: number
  memBytes: number
}

interface Snapshot {
  timestamp: number
  cpu: CpuData
  memory: MemoryData
  disk: DiskData[]
  gpu: GpuData[] | null
  network: NetworkData[]
  processes: ProcessData[]
}

interface TimePoint {
  time: string
  cpuPercent: number
  memUsedGB: number
  memTotalGB: number
  memPercent: number
  gpuPercent: number
  gpuUsedMB: number
  gpuTotalMB: number
  netRxRate: number
  netTxRate: number
}

const MAX_POINTS = 60
const CHART_HEIGHT = 160

interface ChartFrameProps {
  children: (size: { width: number; height: number }) => ReactNode
}

function ChartFrame({ children }: ChartFrameProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const updateWidth = () => setWidth(Math.max(0, Math.floor(frame.getBoundingClientRect().width)))
    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={frameRef} className="h-40 min-w-0">
      {width > 0 ? (
        children({ width, height: CHART_HEIGHT })
      ) : (
        <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--mc-ink-3)]">Measuring chart frame</div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatRate(bps: number): string {
  if (bps >= 1024 ** 3) return `${(bps / 1024 ** 3).toFixed(1)} GB/s`
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`
  if (bps >= 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${Math.round(bps)} B/s`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

function healthTone(value: number, warn = 75, critical = 90): 'teal' | 'amber' | 'rose' {
  if (value >= critical) return 'rose'
  if (value >= warn) return 'amber'
  return 'teal'
}

export function SystemMonitorPanel() {
  const [latest, setLatest] = useState<Snapshot | null>(null)
  const [history, setHistory] = useState<TimePoint[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const prevNetRef = useRef<{ timestamp: number; network: NetworkData[] } | null>(null)

  const fetchData = useCallback(async () => {
    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/system-monitor', { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Snapshot = await res.json()
      setLatest(data)
      setError(null)

      // Compute network rates from cumulative counters
      let netRxRate = 0
      let netTxRate = 0
      const prev = prevNetRef.current
      if (prev && data.network.length > 0) {
        const deltaSec = (data.timestamp - prev.timestamp) / 1000
        if (deltaSec > 0) {
          let totalRxDelta = 0
          let totalTxDelta = 0
          for (const iface of data.network) {
            const prevIface = prev.network.find(p => p.interface === iface.interface)
            if (prevIface) {
              const rxDelta = iface.rxBytes - prevIface.rxBytes
              const txDelta = iface.txBytes - prevIface.txBytes
              // Guard against counter resets
              if (rxDelta >= 0) totalRxDelta += rxDelta
              if (txDelta >= 0) totalTxDelta += txDelta
            }
          }
          netRxRate = totalRxDelta / deltaSec
          netTxRate = totalTxDelta / deltaSec
        }
      }
      prevNetRef.current = { timestamp: data.timestamp, network: data.network }

      setHistory(prevHistory => {
        const point: TimePoint = {
          time: formatTime(data.timestamp),
          cpuPercent: data.cpu.usagePercent,
          memUsedGB: data.memory.usedBytes / 1024 ** 3,
          memTotalGB: data.memory.totalBytes / 1024 ** 3,
          memPercent: data.memory.usagePercent,
          gpuPercent: data.gpu?.[0]?.usagePercent ?? 0,
          gpuUsedMB: data.gpu?.[0]?.memoryUsedMB ?? 0,
          gpuTotalMB: data.gpu?.[0]?.memoryTotalMB ?? 0,
          netRxRate,
          netTxRate,
        }
        const next = [...prevHistory, point]
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next
      })
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message)
    }
  }, [])

  useSmartPoll(fetchData, 2000)

  if (!latest) {
    return (
      <Page title="System Monitor" kicker="Blackwire Ops / Runtime Telemetry" subtitle="Loading local host metrics.">
        {error ? (
          <BoundaryBanner tone="rose" title="System metrics unavailable">{error}</BoundaryBanner>
        ) : (
          <HudPanel>
            <div className="flex h-64 items-center justify-center font-mono text-xs uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">Loading system metrics...</div>
          </HudPanel>
        )}
      </Page>
    )
  }

  return (
    <Page
      kicker="Blackwire Ops / Runtime Telemetry"
      title="System Monitor"
      subtitle={`Local host telemetry captured at ${new Date(latest.timestamp).toLocaleString()}. Read-only visibility for runtime pressure, process drift, and resource bottlenecks.`}
      badges={
        <>
          <Chip tone="teal" pulse>live polling</Chip>
          <Chip tone="dim">read only</Chip>
          {error && <Chip tone="rose">poll error</Chip>}
        </>
      }
    >
      <div className="space-y-4">
        {error && <BoundaryBanner tone="rose" title="System monitor poll failed">{error}</BoundaryBanner>}
        <BoundaryBanner tone="amber" title="Runtime boundary">
          This page observes local host resources only. It does not kill processes, change scheduler state, or mutate infrastructure.
        </BoundaryBanner>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Stat label="CPU" value={`${latest.cpu.usagePercent}%`} sub={`${latest.cpu.cores} cores`} accent={healthTone(latest.cpu.usagePercent)} glow={latest.cpu.usagePercent >= 75} />
          <Stat label="Memory" value={`${latest.memory.usagePercent}%`} sub={`${formatBytes(latest.memory.usedBytes)} used`} accent={healthTone(latest.memory.usagePercent)} glow={latest.memory.usagePercent >= 75} />
          <Stat label="Disk Mounts" value={latest.disk.length} sub={`${Math.max(0, ...latest.disk.map((d) => d.usagePercent))}% max`} accent={healthTone(Math.max(0, ...latest.disk.map((d) => d.usagePercent)))} />
          <Stat label="GPU" value={latest.gpu?.[0] ? `${latest.gpu[0].usagePercent}%` : 'none'} sub={latest.gpu?.[0]?.name || 'not detected'} accent={latest.gpu?.[0] ? healthTone(latest.gpu[0].usagePercent) : 'dim'} />
          <Stat label="Processes" value={latest.processes.length} sub="top sampled" />
        </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        {/* CPU */}
        <HudPanel kicker="host telemetry" title="CPU" className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-mono font-bold tabular-nums">{latest.cpu.usagePercent}%</span>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {latest.cpu.cores} cores &middot; Load: {latest.cpu.loadAvg.map(l => l.toFixed(2)).join(', ')}
          </div>
          <ChartFrame>
            {({ width, height }) => (
              <AreaChart width={width} height={height} data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ fontSize: 12, background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                  formatter={(v: number | undefined) => [`${v ?? 0}%`, 'CPU']}
                />
                <Area
                  type="monotone"
                  dataKey="cpuPercent"
                  stroke="hsl(var(--chart-1, 221 83% 53%))"
                  fill="hsl(var(--chart-1, 221 83% 53%))"
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            )}
          </ChartFrame>
        </HudPanel>

        {/* Memory */}
        <HudPanel kicker="host telemetry" title="Memory" className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-mono font-bold tabular-nums">{latest.memory.usagePercent}%</span>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {formatBytes(latest.memory.usedBytes)} / {formatBytes(latest.memory.totalBytes)}
            {latest.memory.swapTotalBytes > 0 && (
              <> &middot; Swap: {formatBytes(latest.memory.swapUsedBytes)} / {formatBytes(latest.memory.swapTotalBytes)}</>
            )}
          </div>
          <ChartFrame>
            {({ width, height }) => (
              <AreaChart width={width} height={height} data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ fontSize: 12, background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                  formatter={(v: number | undefined) => [`${v ?? 0}%`, 'Memory']}
                />
                <Area
                  type="monotone"
                  dataKey="memPercent"
                  stroke="hsl(var(--chart-2, 142 71% 45%))"
                  fill="hsl(var(--chart-2, 142 71% 45%))"
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            )}
          </ChartFrame>
        </HudPanel>

        {/* Disk */}
        <HudPanel kicker="storage" title="Disk" className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <Chip tone="dim">{latest.disk.length} mounts</Chip>
          </div>
          {latest.disk.length === 0 ? (
            <div className="text-xs text-muted-foreground">No disk data available</div>
          ) : (
            <div className="space-y-3">
              {latest.disk.map(d => (
                <div key={d.mountpoint}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-muted-foreground truncate max-w-[60%]">{d.mountpoint}</span>
                    <span className="tabular-nums">{d.usagePercent}% &middot; {formatBytes(d.usedBytes)} / {formatBytes(d.totalBytes)}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        d.usagePercent >= 90 ? 'bg-red-500' : d.usagePercent >= 75 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${d.usagePercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </HudPanel>

        {/* GPU */}
        <HudPanel kicker="accelerator" title="GPU" className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            {latest.gpu && latest.gpu[0] && (
              <span className="text-2xl font-mono font-bold tabular-nums">{latest.gpu[0].usagePercent}%</span>
            )}
          </div>
          {!latest.gpu ? (
            <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
              No GPU detected
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                {latest.gpu[0].name}
                {latest.gpu[0].memoryTotalMB > 0 && (
                  <> &middot; {latest.gpu[0].memoryUsedMB} MB / {latest.gpu[0].memoryTotalMB} MB</>
                )}
              </div>
              {latest.gpu[0].memoryTotalMB > 0 && latest.gpu[0].memoryUsedMB > 0 ? (
                <ChartFrame>
                  {({ width, height }) => (
                    <AreaChart width={width} height={height} data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                        formatter={(v: number | undefined) => [`${v ?? 0}%`, 'GPU Memory']}
                      />
                      <Area
                        type="monotone"
                        dataKey="gpuPercent"
                        stroke="hsl(var(--chart-4, 280 65% 60%))"
                        fill="hsl(var(--chart-4, 280 65% 60%))"
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  )}
                </ChartFrame>
              ) : (
                <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
                  GPU detected but live memory usage unavailable
                </div>
              )}
            </>
          )}
        </HudPanel>
        {/* Processes */}
        <HudPanel kicker="process sample" title="Top Processes" className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">{latest.processes.length} shown</span>
          </div>
          {latest.processes.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
              No process data available
            </div>
          ) : (
            <div className="space-y-0">
              {/* Header */}
              <div className="flex items-center text-[10px] text-muted-foreground uppercase tracking-wider pb-1.5 border-b border-border mb-1">
                <span className="flex-1">Process</span>
                <span className="w-14 text-right">CPU</span>
                <span className="w-14 text-right">Mem</span>
                <span className="w-16 text-right">RSS</span>
              </div>
              {latest.processes.map(p => (
                <div key={p.pid} className="flex items-center text-xs py-1 border-b border-border/50 last:border-0">
                  <span className="flex-1 truncate font-mono text-muted-foreground" title={`${p.name} (PID ${p.pid})`}>
                    {p.name}
                  </span>
                  <span className={`w-14 text-right tabular-nums font-mono ${p.cpuPercent >= 50 ? 'text-red-400' : p.cpuPercent >= 10 ? 'text-amber-400' : ''}`}>
                    {p.cpuPercent.toFixed(1)}%
                  </span>
                  <span className={`w-14 text-right tabular-nums font-mono ${p.memPercent >= 50 ? 'text-red-400' : p.memPercent >= 10 ? 'text-amber-400' : ''}`}>
                    {p.memPercent.toFixed(1)}%
                  </span>
                  <span className="w-16 text-right tabular-nums font-mono text-muted-foreground">
                    {formatBytes(p.memBytes)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </HudPanel>

        {/* Network I/O */}
        <HudPanel kicker="network" title="Network I/O" className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            {history.length > 0 && (
              <div className="text-right">
                <span className="text-xs text-muted-foreground">
                  RX {formatRate(history[history.length - 1].netRxRate)} / TX {formatRate(history[history.length - 1].netTxRate)}
                </span>
              </div>
            )}
          </div>
          {latest.network.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
              No network data available
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                {latest.network.map(n => n.interface).join(', ')}
              </div>
              <ChartFrame>
                {({ width, height }) => (
                  <AreaChart width={width} height={height} data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={50} tickFormatter={v => formatRate(v)} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
                      formatter={(v: number | undefined, name?: string) => [
                        formatRate(v ?? 0),
                        name === 'netRxRate' ? 'Download' : 'Upload',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="netRxRate"
                      stroke="hsl(var(--chart-5, 25 95% 53%))"
                      fill="hsl(var(--chart-5, 25 95% 53%))"
                      fillOpacity={0.15}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="netTxRate"
                      stroke="hsl(var(--chart-3, 173 58% 39%))"
                      fill="hsl(var(--chart-3, 173 58% 39%))"
                      fillOpacity={0.15}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                )}
              </ChartFrame>
            </>
          )}
        </HudPanel>
      </div>
      </div>
    </Page>
  )
}
