'use client'

import type { ReactNode } from 'react'

type Tone = 'teal' | 'purple' | 'amber' | 'rose' | 'neutral' | 'dim'

const toneClasses: Record<Tone, string> = {
  teal: 'border-[color:var(--mc-teal-dim)] bg-[rgba(46,230,214,0.10)] text-[color:var(--mc-teal-soft)]',
  purple: 'border-[color:var(--mc-purple)] bg-[rgba(168,85,247,0.12)] text-[color:var(--mc-purple-soft)]',
  amber: 'border-[color:var(--mc-amber)] bg-[rgba(245,165,36,0.12)] text-[color:var(--mc-amber)]',
  rose: 'border-[color:var(--mc-rose)] bg-[rgba(255,85,119,0.12)] text-[color:var(--mc-rose)]',
  neutral: 'border-[color:var(--mc-hairline-2)] bg-white/[0.035] text-[color:var(--mc-ink-1)]',
  dim: 'border-[color:var(--mc-hairline)] bg-black/15 text-[color:var(--mc-ink-3)]',
}

export function Brackets() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
      <span className="absolute left-2 top-2 h-3 w-3 border-l border-t border-[color:var(--mc-teal)]/40" />
      <span className="absolute right-2 top-2 h-3 w-3 border-r border-t border-[color:var(--mc-teal)]/40" />
      <span className="absolute bottom-2 left-2 h-3 w-3 border-b border-l border-[color:var(--mc-teal)]/35" />
      <span className="absolute bottom-2 right-2 h-3 w-3 border-b border-r border-[color:var(--mc-teal)]/35" />
    </span>
  )
}

export function Chip({ children, tone = 'neutral', pulse = false }: { children: ReactNode; tone?: Tone; pulse?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${toneClasses[tone]}`}>
      {pulse && <span className="mc-led h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]" />}
      {children}
    </span>
  )
}

export function Btn({
  children,
  variant = 'default',
  small = false,
  onClick,
  as = 'button',
  type = 'button',
}: {
  children: ReactNode
  variant?: 'default' | 'primary' | 'danger'
  small?: boolean
  onClick?: () => void
  as?: 'button' | 'span'
  type?: 'button' | 'submit' | 'reset'
}) {
  const variantClass = variant === 'primary'
    ? 'border-[color:var(--mc-teal)]/60 bg-[rgba(46,230,214,0.14)] text-[color:var(--mc-teal-soft)] shadow-[0_0_18px_rgba(46,230,214,0.12)]'
    : variant === 'danger'
      ? 'border-[color:var(--mc-rose)]/60 bg-[rgba(255,85,119,0.13)] text-[color:var(--mc-rose)]'
      : 'border-[color:var(--mc-hairline-2)] bg-white/[0.04] text-[color:var(--mc-ink-1)]'

  const className = `mc-btn-glitch inline-flex border font-mono font-bold uppercase tracking-[0.12em] transition-colors hover:border-[color:var(--mc-teal)]/55 hover:text-[color:var(--mc-teal-soft)] ${small ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-xs'} ${variantClass}`

  if (as === 'span') {
    return <span className={className}>{children}</span>
  }

  return <button type={type} onClick={onClick} className={className}>{children}</button>
}

export function GlitchTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={`mc-title-glitch font-mono text-3xl font-black uppercase tracking-[0.06em] text-[color:var(--mc-ink-0)] ${className}`}>
      {children}
    </h1>
  )
}

export function HudPanel({
  kicker,
  title,
  right,
  glow = false,
  padded = true,
  children,
  className = '',
}: {
  kicker?: ReactNode
  title?: ReactNode
  right?: ReactNode
  glow?: boolean
  padded?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`mc-bevel mc-notched overflow-hidden ${glow ? 'mc-bevel-glow' : ''} ${className}`}>
      <Brackets />
      {(kicker || title || right) && (
        <div className="relative z-[2] flex items-start justify-between gap-3 border-b border-[color:var(--mc-hairline)] px-3 py-2">
          <div>
            {kicker && <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--mc-teal)]">{kicker}</div>}
            {title && <h2 className="mt-0.5 font-mono text-sm font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-0)]">{title}</h2>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className={`relative z-[2] ${padded ? 'p-3' : ''}`}>{children}</div>
    </section>
  )
}

export function BoundaryBanner({
  tone = 'amber',
  title,
  children,
}: {
  tone?: Exclude<Tone, 'neutral' | 'dim'>
  title: ReactNode
  children: ReactNode
}) {
  const color = tone === 'rose' ? 'var(--mc-rose)' : tone === 'purple' ? 'var(--mc-purple)' : tone === 'teal' ? 'var(--mc-teal)' : 'var(--mc-amber)'
  return (
    <div className="mc-bevel relative overflow-hidden border-l-2 px-3 py-2" style={{ borderLeftColor: color }}>
      <div className="flex gap-3">
        <div className="font-mono text-lg leading-none" style={{ color }}>△</div>
        <div>
          <div className="font-mono text-[11px] font-black uppercase tracking-[0.14em]" style={{ color }}>{title}</div>
          <div className="mt-1 text-xs leading-5 text-[color:var(--mc-ink-1)]">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function Gauge({
  value,
  label,
  color = 'var(--mc-teal)',
  size = 116,
}: {
  value: number
  label: string
  color?: string
  size?: number
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="grid place-items-center" style={{ width: size }}>
      <div
        className="grid place-items-center rounded-full border border-[color:var(--mc-hairline-2)] bg-black/25 font-mono shadow-[inset_0_0_28px_rgba(0,0,0,0.62)]"
        style={{
          width: size,
          height: size,
          backgroundImage: `conic-gradient(${color} ${clamped * 3.6}deg, rgba(90,114,128,0.16) 0deg)`,
        }}
      >
        <div className="grid h-[72%] w-[72%] place-items-center rounded-full bg-[color:var(--mc-bg-2)]">
          <div className="text-center">
            <div className="text-2xl font-black" style={{ color }}>{clamped}%</div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.26em] text-[color:var(--mc-ink-2)]">{label}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Stat({ label, value, sub, accent = 'teal', glow = false }: {
  label: string
  value: ReactNode
  sub?: ReactNode
  accent?: Tone
  glow?: boolean
}) {
  return (
    <HudPanel glow={glow} className="min-h-[94px]">
      <div className="font-mono text-2xl font-black text-[color:var(--mc-ink-0)]">{value}</div>
      <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--mc-ink-2)]">{label}</div>
      {sub && <div className={`mt-2 font-mono text-[10px] ${toneClasses[accent].split(' ').at(-1) || ''}`}>{sub}</div>}
    </HudPanel>
  )
}

export type DataTableColumn<T> = {
  key: string
  label: string
  render?: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  mute?: boolean
  width?: string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
}: {
  columns: Array<DataTableColumn<T>>
  rows: T[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead>
          <tr className="border-b border-[color:var(--mc-hairline)] text-[color:var(--mc-ink-2)]">
            {columns.map((column) => (
              <th key={column.key} className={`px-2 py-2 text-${column.align || 'left'} font-black uppercase tracking-[0.14em]`} style={{ width: column.width }}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? index)} className="border-b border-[color:var(--mc-hairline)]/70 hover:bg-[rgba(46,230,214,0.045)]">
              {columns.map((column) => (
                <td key={column.key} className={`px-2 py-2 text-${column.align || 'left'} ${column.mute ? 'text-[color:var(--mc-ink-2)]' : 'text-[color:var(--mc-ink-0)]'}`}>
                  {column.render ? column.render(row) : String(row[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Page({
  kicker,
  title,
  subtitle,
  badges,
  actions,
  children,
}: {
  kicker?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mc-surface relative min-h-full overflow-hidden p-5 font-[var(--mc-font-text)]">
      <div className="mc-scan" />
      <header className="relative z-[2] mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          {kicker && <div className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--mc-teal)]">{kicker}</div>}
          <GlitchTitle>{title}</GlitchTitle>
          {subtitle && <p className="mt-2 max-w-4xl text-sm leading-6 text-[color:var(--mc-ink-1)]">{subtitle}</p>}
          {badges && <div className="mt-3 flex flex-wrap gap-2">{badges}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      <div className="relative z-[2]">{children}</div>
    </div>
  )
}
