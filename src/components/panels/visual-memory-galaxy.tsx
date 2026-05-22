'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type GalaxyMode = 'overview' | 'agent' | 'project' | 'research' | 'receipts' | 'missing-links'
type GalaxyView = 'inspector' | 'missing-links' | 'project-nexus'

interface GalaxyNode {
  id: string
  label: string
  type: string
  artifactId: string
  sourcePath: string | null
  vaultPath: string | null
  degree: number
  status: 'verified' | 'missing_link' | 'stale' | 'planned' | 'active'
  color: string
  size: number
  glow: string
  tags: string[]
}

interface GalaxyEdge {
  id: string
  source: string
  target: string
  relation: string
  weight: number
  color: string
}

interface GalaxySnapshot {
  generatedAt: number
  sourcePath: string
  mode: string
  stats: {
    totalNodes: number
    totalEdges: number
    visibleNodes: number
    visibleEdges: number
    agents: number
    projects: number
    missingLinks: number
    receipts: number
    research: number
    sourceArtifacts: number
    sourceFreshness: Array<{ label: string; mtime: string | null; exists: boolean }>
  }
  filters: Array<{ key: GalaxyMode; label: string; count: number }>
  actions: Array<{ key: string; label: string; status: 'ready' | 'planned' | 'approval_required'; description: string }>
  nodes: GalaxyNode[]
  edges: GalaxyEdge[]
  selected: GalaxyNode | null
}

interface PlottedNode extends GalaxyNode {
  x: number
  y: number
  r: number
  depth: number
  labelAnchor: 'start' | 'middle' | 'end'
}

type MissingQueueNode = GalaxyNode & { duplicateCount: number; sourceGroup: string; sourceGroupCount: number; sourceDiversity: number }
type ProjectNexusNode = GalaxyNode & { sourceGroup: string; sourceLabel: string; neighborhood: string; relationMix: string; directLinks: number }

const CANVAS_W = 1200
const CANVAS_H = 760
const CENTER_X = CANVAS_W / 2
const CENTER_Y = CANVAS_H / 2 + 10

const ORBITAL_SHELLS = [126, 206, 298, 402, 512]
const STAR_FIELD = Array.from({ length: 140 }, (_, index) => ({
  id: `star-${index}`,
  x: (index * 89 + 37) % CANVAS_W,
  y: (index * 53 + 91) % CANVAS_H,
  r: 0.6 + (index % 4) * 0.34,
  opacity: 0.12 + (index % 9) * 0.04,
  delay: `${-(index % 13) * 0.42}s`,
}))

const NEBULA_RIBBONS = [
  { id: 'violet-rift', d: 'M -70 532 C 194 382 337 432 507 315 S 861 168 1277 252', stroke: '#9b5cff', opacity: 0.28, width: 18, dash: '2 34' },
  { id: 'cyan-rift', d: 'M -48 266 C 189 346 326 206 538 262 S 900 462 1249 344', stroke: '#55f1ff', opacity: 0.22, width: 13, dash: '1 28' },
  { id: 'magenta-rift', d: 'M 14 650 C 245 510 407 602 608 455 S 944 234 1214 118', stroke: '#ff4fb8', opacity: 0.18, width: 10, dash: '12 30' },
]

const LENS_FLARES = [
  { id: 'flare-core-left', x: 448, y: 309, r: 2.8, color: '#ffffff', opacity: 0.72 },
  { id: 'flare-cyan-upper', x: 764, y: 212, r: 2.2, color: '#55f1ff', opacity: 0.64 },
  { id: 'flare-magenta-lower', x: 703, y: 531, r: 2.4, color: '#ff4fb8', opacity: 0.58 },
  { id: 'flare-violet-edge', x: 313, y: 491, r: 1.9, color: '#9b5cff', opacity: 0.58 },
]

const CONSTELLATION_ARCS = [
  { id: 'upper-command-arc', d: 'M 236 238 C 390 118 719 112 912 246', stroke: '#55f1ff', opacity: 0.18, width: 1.3, dash: '4 18' },
  { id: 'lower-vault-arc', d: 'M 254 548 C 445 674 792 648 970 502', stroke: '#9b5cff', opacity: 0.2, width: 1.5, dash: '2 14' },
  { id: 'missing-link-arc', d: 'M 146 404 C 336 350 418 562 612 458 S 895 280 1056 348', stroke: '#ffd166', opacity: 0.16, width: 1.1, dash: '10 22' },
  { id: 'project-nexus-arc', d: 'M 390 174 C 502 268 656 270 796 176', stroke: '#ff4fb8', opacity: 0.16, width: 1.2, dash: '1 12' },
]

const DEPTH_BEAMS = [
  { id: 'left-vault-beam', points: '84,92 572,352 536,382 26,188', fill: '#9b5cff', opacity: 0.08 },
  { id: 'right-command-beam', points: '1118,116 650,350 684,384 1194,230', fill: '#55f1ff', opacity: 0.075 },
  { id: 'lower-memory-beam', points: '230,744 585,426 626,431 1000,744', fill: '#ff4fb8', opacity: 0.06 },
]

const MEGA_DEPTH_RAYS = [
  { id: 'mega-ray-northwest', d: 'M 146 58 C 286 154 438 254 574 362', stroke: '#9b5cff', opacity: 0.11, width: 2.6, dash: '1 22', duration: 58 },
  { id: 'mega-ray-northeast', d: 'M 1064 82 C 914 162 772 244 638 366', stroke: '#55f1ff', opacity: 0.12, width: 2.2, dash: '10 34', duration: 64 },
  { id: 'mega-ray-west', d: 'M 24 410 C 224 392 390 414 558 392', stroke: '#ffd166', opacity: 0.075, width: 1.8, dash: '2 26', duration: 72 },
  { id: 'mega-ray-east', d: 'M 1180 426 C 984 386 806 438 642 402', stroke: '#ff4fb8', opacity: 0.095, width: 2.0, dash: '14 38', duration: 69 },
  { id: 'mega-ray-southwest', d: 'M 176 720 C 338 604 458 520 584 426', stroke: '#55f1ff', opacity: 0.085, width: 1.9, dash: '1 30', duration: 76 },
  { id: 'mega-ray-southeast', d: 'M 1028 704 C 870 586 760 516 622 426', stroke: '#9b5cff', opacity: 0.10, width: 2.1, dash: '8 32', duration: 61 },
]

const CINEMATIC_VANISHING_GRID = [
  { id: 'vanish-axis-north', d: 'M 602 -24 C 586 150 595 282 606 380 S 626 610 612 784', stroke: '#ffffff', opacity: 0.055, dash: '1 28', width: 0.9, duration: 94 },
  { id: 'vanish-axis-west', d: 'M -28 382 C 206 376 414 384 600 394 S 952 418 1230 382', stroke: '#55f1ff', opacity: 0.075, dash: '3 30', width: 1.0, duration: 88 },
  { id: 'vanish-axis-east', d: 'M 1218 170 C 980 252 806 314 628 382 S 296 502 -30 638', stroke: '#9b5cff', opacity: 0.07, dash: '10 40', width: 1.0, duration: 102 },
  { id: 'vanish-axis-west-high', d: 'M -24 116 C 266 206 436 286 590 376 S 852 556 1218 646', stroke: '#ff4fb8', opacity: 0.062, dash: '1 36', width: 0.95, duration: 98 },
]

const OBSIDIAN_SHARDS = [
  { id: 'obsidian-west-crown', points: '194,104 256,68 310,142 244,174', fill: '#120b25', stroke: '#9b5cff', opacity: 0.38, delay: '-2.4s' },
  { id: 'obsidian-east-crown', points: '912,82 1004,122 968,205 872,182', fill: '#071729', stroke: '#55f1ff', opacity: 0.34, delay: '-4.8s' },
  { id: 'obsidian-south-gate', points: '498,648 608,596 724,670 612,724', fill: '#160918', stroke: '#ff4fb8', opacity: 0.30, delay: '-7.2s' },
  { id: 'obsidian-north-core', points: '532,118 612,82 690,138 622,182', fill: '#0a0d26', stroke: '#ffffff', opacity: 0.24, delay: '-9.6s' },
]

const HOLOGRAPHIC_RINGS = [
  { id: 'mega-outer-ring', rx: 560, ry: 374, stroke: '#55f1ff', opacity: 0.055, width: 2.2, dash: '28 42', rotate: -7, duration: '138s' },
  { id: 'obsidian-memory-ring', rx: 476, ry: 302, stroke: '#9b5cff', opacity: 0.075, width: 1.6, dash: '2 24', rotate: 17, duration: '112s' },
  { id: 'galaxy-brain-ring', rx: 356, ry: 218, stroke: '#ff4fb8', opacity: 0.065, width: 1.4, dash: '14 26', rotate: -26, duration: '96s' },
]

const PARALLAX_THREADS = [
  { id: 'thread-violet-a', d: 'M 78 176 C 314 246 414 342 610 376 S 946 386 1132 500', stroke: '#9b5cff', opacity: 0.2, dash: '2 20' },
  { id: 'thread-cyan-b', d: 'M 1124 170 C 906 260 846 350 622 386 S 304 468 92 608', stroke: '#55f1ff', opacity: 0.18, dash: '8 24' },
  { id: 'thread-gold-c', d: 'M 174 302 C 354 316 434 430 592 418 S 882 314 1038 380', stroke: '#ffd166', opacity: 0.13, dash: '1 16' },
]

const NEURAL_FILAMENTS = [
  { id: 'synapse-upper-left', d: 'M 332 214 C 436 286 494 244 592 346 S 760 442 874 348', stroke: '#55f1ff', opacity: 0.19, width: 0.95, dash: '1 11', duration: 28 },
  { id: 'synapse-upper-right', d: 'M 838 196 C 748 278 704 246 608 354 S 432 454 326 378', stroke: '#ff4fb8', opacity: 0.16, width: 0.9, dash: '7 19', duration: 34 },
  { id: 'synapse-lower-arc', d: 'M 292 508 C 430 430 498 548 618 426 S 808 316 954 456', stroke: '#9b5cff', opacity: 0.18, width: 1.05, dash: '2 15', duration: 31 },
  { id: 'synapse-spine', d: 'M 604 134 C 548 260 676 302 604 424 S 560 604 636 696', stroke: '#ffffff', opacity: 0.10, width: 0.85, dash: '1 17', duration: 42 },
]

const SINGULARITY_HALOS = [
  { id: 'core-white-halo', r: 118, color: '#ffffff', opacity: 0.07, dash: '1 18', width: 1.1, duration: '68s' },
  { id: 'core-cyan-halo', r: 156, color: '#55f1ff', opacity: 0.085, dash: '9 24', width: 1.3, duration: '82s' },
  { id: 'core-magenta-halo', r: 196, color: '#ff4fb8', opacity: 0.065, dash: '2 22', width: 1.0, duration: '96s' },
]

const MEMORY_COMETS = [
  { id: 'comet-atlas', d: 'M 128 148 C 248 192 374 248 520 342', stroke: '#55f1ff', opacity: 0.24, width: 1.35, dash: '36 120', duration: 38 },
  { id: 'comet-herald', d: 'M 1090 182 C 942 244 806 274 652 362', stroke: '#ff4fb8', opacity: 0.22, width: 1.25, dash: '30 132', duration: 43 },
  { id: 'comet-ledger', d: 'M 180 676 C 316 588 462 520 584 424', stroke: '#9b5cff', opacity: 0.23, width: 1.2, dash: '26 126', duration: 46 },
  { id: 'comet-knox', d: 'M 1072 640 C 902 556 760 502 626 420', stroke: '#ffd166', opacity: 0.16, width: 1.05, dash: '22 118', duration: 51 },
]

function compact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return value.toLocaleString()
}

function statusLabel(status: GalaxyNode['status']): string {
  if (status === 'missing_link') return 'missing link'
  if (status === 'stale') return 'needs review'
  return status
}

function truncate(value: string, length = 42): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

function displayPath(node: GalaxyNode | null): string {
  if (!node) return 'Select a node to inspect source truth.'
  return node.vaultPath || node.sourcePath || node.artifactId || node.id
}

function summarizeNeighborhood(node: GalaxyNode, nodesById: Map<string, GalaxyNode>, edges: GalaxyEdge[], maxItems = 3): string {
  const neighbors: string[] = []

  for (const edge of edges) {
    const neighborId = edge.source === node.id ? edge.target : edge.target === node.id ? edge.source : null
    if (!neighborId) continue
    const neighbor = nodesById.get(neighborId)
    if (!neighbor) continue
    const label = truncate(neighbor.label || neighbor.artifactId || neighbor.id, 24)
    if (!neighbors.includes(label)) neighbors.push(label)
    if (neighbors.length >= maxItems) break
  }

  return neighbors.length ? neighbors.join(' / ') : 'No visible source neighbors in this slice'
}

function summarizeRelations(node: GalaxyNode, edges: GalaxyEdge[], maxItems = 2): { relationMix: string; directLinks: number } {
  const relationCounts = new Map<string, number>()

  for (const edge of edges) {
    if (edge.source !== node.id && edge.target !== node.id) continue
    const relation = edge.relation.replace(/_/g, ' ')
    relationCounts.set(relation, (relationCounts.get(relation) || 0) + 1)
  }

  const directLinks = Array.from(relationCounts.values()).reduce((sum, count) => sum + count, 0)
  const relationMix = Array.from(relationCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxItems)
    .map(([relation, count]) => `${relation} ${count}`)
    .join(' / ')

  return { directLinks, relationMix: relationMix || 'relation mix pending in visible slice' }
}

function normalizeMissingLinkLabel(node: GalaxyNode): string {
  return (node.label || node.artifactId || node.id).trim().toLowerCase()
}

function sourceGroupLabel(node: GalaxyNode): string {
  const path = node.sourcePath || node.vaultPath || node.artifactId || ''
  if (!path) return 'unmapped source'
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length >= 2) return parts[parts.length - 2]
  return parts[0] || 'unmapped source'
}

function sourceJumpLabel(node: GalaxyNode): string {
  const path = node.vaultPath || node.sourcePath || node.artifactId || node.id
  const normalized = path.replace(/\\/g, '/')
  return truncate(normalized.split('/').filter(Boolean).pop() || path, 30)
}

function relevanceBand(node: GalaxyNode & { duplicateCount?: number }): string {
  const score = node.degree + (node.duplicateCount || 0) * 2
  if (score >= 16) return 'hot cluster'
  if (score >= 8) return 'triage next'
  return 'watchlist'
}

function sourceDiversityLabel(count: number): string {
  if (count >= 5) return `${count} source groups`
  if (count >= 2) return `${count} source groups`
  return 'single source group'
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#080615]/68 p-3 shadow-[0_0_28px_rgba(155,92,255,0.10)] backdrop-blur-xl">
      <div className="mb-2 h-1 rounded-full" style={{ background: tone, boxShadow: `0 0 18px ${tone}` }} />
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#a79bc9]/70">{label}</div>
      <div className="mt-1 font-mono text-xl text-[#f7f1ff]">{typeof value === 'number' ? compact(value) : value}</div>
    </div>
  )
}

function angleForIndex(index: number, total: number, offset = -Math.PI / 2): number {
  return offset + (Math.PI * 2 * index) / Math.max(total, 1)
}

function labelAnchor(x: number): PlottedNode['labelAnchor'] {
  if (x < CENTER_X - 96) return 'end'
  if (x > CENTER_X + 96) return 'start'
  return 'middle'
}

function plotNodes(nodes: GalaxyNode[]): PlottedNode[] {
  const canonical = nodes.filter((node) => node.type === 'agent' || node.type === 'project' || node.type === 'agent_group')
  const rest = nodes.filter((node) => !(node.type === 'agent' || node.type === 'project' || node.type === 'agent_group'))
  const plotted: PlottedNode[] = []

  canonical.forEach((node, index) => {
    const angle = angleForIndex(index, canonical.length, -Math.PI / 2.05)
    const ring = node.type === 'agent_group' ? 0 : node.type === 'agent' ? 145 : 246
    const jitter = (node.id.length % 23) - 9
    const x = CENTER_X + Math.cos(angle) * (ring + jitter)
    const y = CENTER_Y + Math.sin(angle) * (ring + jitter * 0.6)
    plotted.push({ ...node, x, y, r: Math.max(12, Math.min(29, node.size)), depth: node.type === 'agent_group' ? 1 : 0.88, labelAnchor: labelAnchor(x) })
  })

  rest.slice(0, 348).forEach((node, index) => {
    const ringSlot = index % 5
    const spiralTurn = Math.floor(index / 5)
    const ring = 308 + ringSlot * 44 + Math.min(92, spiralTurn * 1.1)
    const angle = angleForIndex(index, Math.max(rest.length, 1), ringSlot * 0.52 + Math.sin(index * 0.17) * 0.18)
    const wave = Math.sin(index * 1.73) * 24 + Math.cos(index * 0.41) * 12
    const x = CENTER_X + Math.cos(angle) * (ring + wave)
    const y = CENTER_Y + Math.sin(angle) * (ring * 0.84 + wave)
    const depth = 0.35 + ringSlot * 0.12
    plotted.push({ ...node, x, y, r: Math.max(2.7, Math.min(8.2, node.size * 0.54)), depth, labelAnchor: labelAnchor(x) })
  })

  return plotted
}

function curvedPath(source: PlottedNode, target: PlottedNode, index: number): string {
  const mx = (source.x + target.x) / 2
  const my = (source.y + target.y) / 2
  const dx = target.x - source.x
  const dy = target.y - source.y
  const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy))
  const bow = Math.min(74, Math.max(18, distance * 0.12)) * (index % 2 === 0 ? 1 : -1)
  const cx = mx - (dy / distance) * bow
  const cy = my + (dx / distance) * bow
  return `M ${source.x.toFixed(1)} ${source.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${target.x.toFixed(1)} ${target.y.toFixed(1)}`
}

interface VisualMemoryGalaxyProps {
  initialPresentationMode?: boolean
  demoMode?: boolean
}

export function VisualMemoryGalaxy({ initialPresentationMode = false, demoMode = false }: VisualMemoryGalaxyProps = {}) {
  const [mode, setMode] = useState<GalaxyMode>('overview')
  const [view, setView] = useState<GalaxyView>('inspector')
  const [snapshot, setSnapshot] = useState<GalaxySnapshot | null>(null)
  const [selected, setSelected] = useState<GalaxyNode | null>(null)
  const [hovered, setHovered] = useState<GalaxyNode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [presentationMode, setPresentationMode] = useState(initialPresentationMode || demoMode)

  const fetchGalaxy = useCallback(async (nextMode = mode, selectedId?: string | null) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ mode: nextMode, limit: nextMode === 'overview' ? '240' : '260' })
      if (selectedId) params.set('id', selectedId)
      const response = await fetch(`/api/memory/visual-graph/ui?${params.toString()}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json() as GalaxySnapshot
      setSnapshot(data)
      setSelected(data.selected)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Visual Memory Galaxy')
    } finally {
      setIsLoading(false)
    }
  }, [mode])

  useEffect(() => { fetchGalaxy(mode) }, [fetchGalaxy, mode])

  const plottedNodes = useMemo(() => plotNodes(snapshot?.nodes || []), [snapshot])
  const plottedById = useMemo(() => new Map(plottedNodes.map((node) => [node.id, node])), [plottedNodes])
  const nodesById = useMemo(() => new Map((snapshot?.nodes || []).map((node) => [node.id, node])), [snapshot])
  const selectedPlotted = selected ? plottedById.get(selected.id) || null : null
  const stats = snapshot?.stats
  const showLoadingOverlay = isLoading && !demoMode
  const visibleEdges = useMemo(() => (snapshot?.edges || [])
    .map((edge, index) => ({ edge, index, source: plottedById.get(edge.source), target: plottedById.get(edge.target) }))
    .filter((item): item is { edge: GalaxyEdge; index: number; source: PlottedNode; target: PlottedNode } => Boolean(item.source && item.target))
    .slice(0, 420), [snapshot, plottedById])
  const missingQueue = useMemo(() => {
    const sourceCounts = new Map<string, number>()
    const labelSourceGroups = new Map<string, Set<string>>()
    for (const node of snapshot?.nodes || []) {
      if (node.status !== 'missing_link') continue
      const sourceGroup = sourceGroupLabel(node)
      const labelKey = normalizeMissingLinkLabel(node)
      sourceCounts.set(sourceGroup, (sourceCounts.get(sourceGroup) || 0) + 1)
      const sourceSet = labelSourceGroups.get(labelKey) || new Set<string>()
      sourceSet.add(sourceGroup)
      labelSourceGroups.set(labelKey, sourceSet)
    }

    const grouped = new Map<string, MissingQueueNode>()

    for (const node of snapshot?.nodes || []) {
      if (node.status !== 'missing_link') continue
      const key = normalizeMissingLinkLabel(node)
      const sourceGroup = sourceGroupLabel(node)
      const duplicateCount = 1
      const sourceGroupCount = sourceCounts.get(sourceGroup) || 1
      const current = grouped.get(key)
      const sourceDiversity = labelSourceGroups.get(key)?.size || 1
      if (!current || node.degree > current.degree) {
        grouped.set(key, { ...node, duplicateCount: (current?.duplicateCount || 0) + duplicateCount, sourceGroup, sourceGroupCount, sourceDiversity })
      } else {
        current.duplicateCount += duplicateCount
        current.sourceGroupCount = Math.max(current.sourceGroupCount, sourceGroupCount)
        current.sourceDiversity = Math.max(current.sourceDiversity, sourceDiversity)
      }
    }

    const ranked = Array.from(grouped.values())
      .sort((a, b) => b.sourceDiversity - a.sourceDiversity || b.sourceGroupCount - a.sourceGroupCount || b.degree - a.degree || b.duplicateCount - a.duplicateCount || a.label.localeCompare(b.label))
    const diversified: MissingQueueNode[] = []
    const surfacedSourceGroups = new Set<string>()

    for (const node of ranked) {
      if (diversified.length >= 8) break
      if (surfacedSourceGroups.has(node.sourceGroup)) continue
      diversified.push(node)
      surfacedSourceGroups.add(node.sourceGroup)
    }

    for (const node of ranked) {
      if (diversified.length >= 8) break
      if (diversified.some((candidate) => candidate.id === node.id)) continue
      diversified.push(node)
    }

    return diversified
  }, [snapshot])
  const projectNexus = useMemo<ProjectNexusNode[]>(() => (snapshot?.nodes || [])
    .filter((node) => node.type === 'project' || node.type === 'agent' || node.type === 'agent_group')
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 10)
    .map((node) => {
      const relationSummary = summarizeRelations(node, snapshot?.edges || [])
      return {
        ...node,
        ...relationSummary,
        sourceGroup: sourceGroupLabel(node),
        sourceLabel: sourceJumpLabel(node),
        neighborhood: summarizeNeighborhood(node, nodesById, snapshot?.edges || []),
      }
    }), [snapshot, nodesById])
  const projectNexusSummary = useMemo(() => ({
    projects: projectNexus.filter((node) => node.type === 'project').length,
    operators: projectNexus.filter((node) => node.type === 'agent' || node.type === 'agent_group').length,
    active: projectNexus.filter((node) => node.status === 'active').length,
  }), [projectNexus])

  const runAction = (key: string) => {
    if (key === 'missing-links') {
      setMode('missing-links')
      setView('missing-links')
      return
    }
    if (key === 'project-nexus') {
      setMode('project')
      setView('project-nexus')
      return
    }
    setView('inspector')
  }

  return (
    <div className={`relative h-full min-h-[720px] w-full overflow-hidden bg-[#03020a] text-[#f7f1ff] shadow-[0_0_90px_rgba(85,241,255,0.10)] ${demoMode ? '' : 'rounded-3xl border border-[#9b5cff]/20'}`}>
      <style>{`
        @keyframes galaxy-orbit-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes galaxy-orbit-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes galaxy-core-pulse { 0%, 100% { opacity: .58; transform: scale(.985); } 50% { opacity: .86; transform: scale(1.035); } }
        @keyframes galaxy-star-drift { 0%, 100% { opacity: .22; transform: translate3d(0, 0, 0); } 50% { opacity: .72; transform: translate3d(10px, -7px, 0); } }
        @keyframes galaxy-trail-dash { to { stroke-dashoffset: -180; } }
        @keyframes galaxy-ribbon-flow { 0% { stroke-dashoffset: 0; opacity: .14; } 50% { opacity: .34; } 100% { stroke-dashoffset: -220; opacity: .14; } }
        @keyframes galaxy-flare-breathe { 0%, 100% { opacity: .38; transform: scale(.88); } 50% { opacity: .92; transform: scale(1.22); } }
        @keyframes galaxy-arc-drift { 0% { stroke-dashoffset: 0; opacity: .10; } 50% { opacity: .26; } 100% { stroke-dashoffset: -260; opacity: .10; } }
        @keyframes galaxy-thread-drift { 0% { stroke-dashoffset: 0; opacity: .08; } 50% { opacity: .24; } 100% { stroke-dashoffset: -320; opacity: .08; } }
        @keyframes galaxy-shard-float { 0%, 100% { opacity: .20; transform: translate3d(0, 0, 0) scale(.98); } 50% { opacity: .50; transform: translate3d(8px, -10px, 0) scale(1.035); } }
        @keyframes galaxy-ring-phase { to { stroke-dashoffset: -420; } }
        @keyframes galaxy-synapse-flow { 0% { stroke-dashoffset: 0; opacity: .08; } 50% { opacity: .24; } 100% { stroke-dashoffset: -190; opacity: .08; } }
        @keyframes galaxy-halo-phase { from { stroke-dashoffset: 0; transform: rotate(0deg); } to { stroke-dashoffset: -240; transform: rotate(360deg); } }
        @keyframes galaxy-comet-run { 0% { stroke-dashoffset: 180; opacity: .05; } 42% { opacity: .30; } 100% { stroke-dashoffset: -360; opacity: .05; } }
        @media (prefers-reduced-motion: reduce) {
          .galaxy-animate { animation: none !important; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_49%_38%,rgba(155,92,255,0.32),transparent_27%),radial-gradient(circle_at_62%_46%,rgba(255,79,184,0.17),transparent_21%),radial-gradient(circle_at_73%_62%,rgba(85,241,255,0.16),transparent_27%),linear-gradient(180deg,#03020a,#080614)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle,rgba(255,255,255,0.52)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70rem] w-[92rem] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#55f1ff]/10 shadow-[inset_0_0_80px_rgba(85,241,255,0.08),0_0_120px_rgba(155,92,255,0.10)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[46rem] w-[72rem] -translate-x-1/2 -translate-y-1/2 rotate-[-11deg] rounded-[50%] border border-[#ff4fb8]/10 shadow-[0_0_90px_rgba(255,79,184,0.08)]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-[34rem] w-[34rem] rounded-full bg-[#9b5cff]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-8 h-[32rem] w-[32rem] rounded-full bg-[#55f1ff]/10 blur-3xl" />

      {!presentationMode && <div className="absolute left-4 right-4 top-4 z-20 flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#55f1ff]">Mission Control</div>
          <div className="text-2xl font-semibold tracking-tight text-white drop-shadow-[0_0_22px_rgba(155,92,255,0.62)]">Visual Memory Galaxy</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[#a79bc9]/70">truth graph · read-only actions · source-backed nodes</div>
        </div>
        <div className="flex max-w-[52rem] flex-wrap items-center justify-end gap-2 rounded-2xl border border-white/10 bg-[#080615]/72 p-2 backdrop-blur-xl">
          {(snapshot?.filters || [
            { key: 'overview', label: 'Overview', count: 0 },
            { key: 'agent', label: 'Agents', count: 0 },
            { key: 'project', label: 'Projects', count: 0 },
            { key: 'missing-links', label: 'Missing Links', count: 0 },
          ]).map((filter) => (
            <button key={filter.key} onClick={() => { setMode(filter.key); setView(filter.key === 'missing-links' ? 'missing-links' : filter.key === 'project' ? 'project-nexus' : 'inspector') }} className={`rounded-xl px-3 py-2 font-mono text-[11px] transition-all ${mode === filter.key ? 'bg-[#9b5cff]/25 text-white shadow-[0_0_22px_rgba(155,92,255,0.32)] ring-1 ring-[#9b5cff]/50' : 'text-[#a79bc9] hover:bg-white/5 hover:text-white'}`}>
              {filter.label} <span className="text-[#55f1ff]/70">{compact(filter.count)}</span>
            </button>
          ))}
          <button onClick={() => setPresentationMode(true)} className="rounded-xl px-3 py-2 font-mono text-[11px] text-[#a79bc9] transition-all hover:bg-white/5 hover:text-white">Presentation</button>
        </div>
      </div>}

      {presentationMode && !demoMode && <button onClick={() => setPresentationMode(false)} className="absolute right-4 top-4 z-30 rounded-full border border-white/10 bg-[#080615]/44 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#d8d0ef]/70 backdrop-blur-xl transition hover:border-[#55f1ff]/40 hover:text-white">Exit presentation</button>}

      <div className="absolute inset-0 z-10">
        {showLoadingOverlay && <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#03020a]/60 font-mono text-sm text-[#a79bc9] backdrop-blur-sm">Loading Visual Memory Galaxy...</div>}
        {error && <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#03020a]/80 font-mono text-sm text-[#ff4d6d]">{error}</div>}
        <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="absolute inset-0 h-full w-full" role="img" aria-label="Vortex Visual Memory Galaxy">
          <defs>
            <filter id="galaxyGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="5.5" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0.45 0 1 0 0 0.12 0 0 1 0 1 0 0 0 0.88 0" result="glow" />
              <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="lineGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <radialGradient id="coreGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="34%" stopColor="#ff4fb8" stopOpacity="0.62" />
              <stop offset="62%" stopColor="#9b5cff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#03020a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="lensFlareGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
              <stop offset="30%" stopColor="#55f1ff" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#03020a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="depthVignette" cx="50%" cy="50%" r="64%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="68%" stopColor="#03020a" stopOpacity="0" />
              <stop offset="100%" stopColor="#020108" stopOpacity="0.66" />
            </radialGradient>
          </defs>
          <g opacity="0.9">
            {DEPTH_BEAMS.map((beam) => (
              <polygon key={beam.id} points={beam.points} fill={beam.fill} opacity={beam.opacity} />
            ))}
          </g>
          <g opacity="0.9">
            {CINEMATIC_VANISHING_GRID.map((line, index) => (
              <path
                key={line.id}
                className="galaxy-animate"
                d={line.d}
                fill="none"
                stroke={line.stroke}
                strokeOpacity={line.opacity}
                strokeWidth={line.width}
                strokeLinecap="round"
                strokeDasharray={line.dash}
                filter="url(#lineGlow)"
                style={{ animation: `galaxy-thread-drift ${line.duration}s ease-in-out infinite`, animationDelay: `${index * -9}s` }}
              />
            ))}
          </g>
          <g opacity="0.9">
            {MEGA_DEPTH_RAYS.map((ray, index) => (
              <path
                key={ray.id}
                className="galaxy-animate"
                d={ray.d}
                fill="none"
                stroke={ray.stroke}
                strokeOpacity={ray.opacity}
                strokeWidth={ray.width}
                strokeLinecap="round"
                strokeDasharray={ray.dash}
                filter="url(#lineGlow)"
                style={{ animation: `galaxy-thread-drift ${ray.duration}s ease-in-out infinite`, animationDelay: `${index * -6}s` }}
              />
            ))}
          </g>
          <g opacity="0.95">
            {OBSIDIAN_SHARDS.map((shard) => (
              <polygon
                key={shard.id}
                className="galaxy-animate"
                points={shard.points}
                fill={shard.fill}
                stroke={shard.stroke}
                strokeOpacity="0.42"
                strokeWidth="1.2"
                opacity={shard.opacity}
                filter="url(#lineGlow)"
                style={{ animation: 'galaxy-shard-float 18s ease-in-out infinite', animationDelay: shard.delay }}
              />
            ))}
          </g>
          <g opacity="0.72">
            {NEBULA_RIBBONS.map((ribbon, index) => (
              <path
                key={ribbon.id}
                className="galaxy-animate"
                d={ribbon.d}
                fill="none"
                stroke={ribbon.stroke}
                strokeOpacity={ribbon.opacity}
                strokeWidth={ribbon.width}
                strokeLinecap="round"
                strokeDasharray={ribbon.dash}
                filter="url(#lineGlow)"
                style={{ animation: `galaxy-ribbon-flow ${34 + index * 9}s ease-in-out infinite` }}
              />
            ))}
          </g>
          <g className="galaxy-animate" style={{ transformBox: 'fill-box', transformOrigin: `${CENTER_X}px ${CENTER_Y}px`, animation: 'galaxy-orbit-reverse 164s linear infinite' }}>
            {LENS_FLARES.map((flare, index) => (
              <g key={flare.id} className="galaxy-animate" style={{ transformBox: 'fill-box', transformOrigin: `${flare.x}px ${flare.y}px`, animation: `galaxy-flare-breathe ${7.5 + index}s ease-in-out infinite` }}>
                <circle cx={flare.x} cy={flare.y} r={flare.r * 18} fill="url(#lensFlareGradient)" opacity={flare.opacity * 0.28} />
                <circle cx={flare.x} cy={flare.y} r={flare.r} fill={flare.color} opacity={flare.opacity} />
                <line x1={flare.x - flare.r * 18} y1={flare.y} x2={flare.x + flare.r * 18} y2={flare.y} stroke={flare.color} strokeOpacity={flare.opacity * 0.32} strokeWidth="0.8" />
                <line x1={flare.x} y1={flare.y - flare.r * 12} x2={flare.x} y2={flare.y + flare.r * 12} stroke={flare.color} strokeOpacity={flare.opacity * 0.22} strokeWidth="0.8" />
              </g>
            ))}
          </g>
          {STAR_FIELD.map((star) => (
            <circle
              key={star.id}
              className="galaxy-animate"
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#ffffff"
              opacity={star.opacity}
              style={{ animation: `galaxy-star-drift ${5 + (star.r * 2)}s ease-in-out infinite`, animationDelay: star.delay }}
            />
          ))}
          <g className="galaxy-animate" style={{ transformBox: 'fill-box', transformOrigin: `${CENTER_X}px ${CENTER_Y}px`, animation: 'galaxy-orbit-slow 74s linear infinite' }}>
            <ellipse cx={CENTER_X} cy={CENTER_Y} rx="170" ry="56" fill="#9b5cff" opacity="0.08" transform={`rotate(-12 ${CENTER_X} ${CENTER_Y})`} />
            {ORBITAL_SHELLS.map((r, index) => <ellipse key={r} cx={CENTER_X} cy={CENTER_Y} rx={r} ry={r * 0.78} fill="none" stroke={index % 2 ? '#55f1ff' : '#9b5cff'} strokeOpacity={0.08 + index * 0.024} strokeWidth="1.2" strokeDasharray={index % 2 ? '3 15' : '1 18'} transform={`rotate(${-10 + index * 5} ${CENTER_X} ${CENTER_Y})`} />)}
          </g>
          <g>
            {HOLOGRAPHIC_RINGS.map((ring) => (
              <ellipse
                key={ring.id}
                className="galaxy-animate"
                cx={CENTER_X}
                cy={CENTER_Y}
                rx={ring.rx}
                ry={ring.ry}
                fill="none"
                stroke={ring.stroke}
                strokeOpacity={ring.opacity}
                strokeWidth={ring.width}
                strokeDasharray={ring.dash}
                filter="url(#lineGlow)"
                transform={`rotate(${ring.rotate} ${CENTER_X} ${CENTER_Y})`}
                style={{ animation: `galaxy-ring-phase ${ring.duration} linear infinite` }}
              />
            ))}
          </g>
          <g className="galaxy-animate" style={{ transformBox: 'fill-box', transformOrigin: `${CENTER_X}px ${CENTER_Y}px`, animation: 'galaxy-orbit-reverse 118s linear infinite' }}>
            <ellipse cx={CENTER_X} cy={CENTER_Y} rx="438" ry="318" fill="none" stroke="#ff4fb8" strokeOpacity="0.08" strokeWidth="1.4" strokeDasharray="2 22" transform={`rotate(24 ${CENTER_X} ${CENTER_Y})`} />
            <ellipse cx={CENTER_X} cy={CENTER_Y} rx="548" ry="366" fill="none" stroke="#55f1ff" strokeOpacity="0.07" strokeWidth="1" strokeDasharray="10 30" transform={`rotate(-18 ${CENTER_X} ${CENTER_Y})`} />
          </g>
          <g opacity="0.88">
            {CONSTELLATION_ARCS.map((arc, index) => (
              <path
                key={arc.id}
                className="galaxy-animate"
                d={arc.d}
                fill="none"
                stroke={arc.stroke}
                strokeOpacity={arc.opacity}
                strokeWidth={arc.width}
                strokeLinecap="round"
                strokeDasharray={arc.dash}
                filter="url(#lineGlow)"
                style={{ animation: `galaxy-arc-drift ${44 + index * 7}s ease-in-out infinite` }}
              />
            ))}
          </g>
          <g opacity="0.82">
            {PARALLAX_THREADS.map((thread, index) => (
              <path
                key={thread.id}
                className="galaxy-animate"
                d={thread.d}
                fill="none"
                stroke={thread.stroke}
                strokeOpacity={thread.opacity}
                strokeWidth="0.9"
                strokeLinecap="round"
                strokeDasharray={thread.dash}
                filter="url(#lineGlow)"
                style={{ animation: `galaxy-thread-drift ${52 + index * 11}s ease-in-out infinite` }}
              />
            ))}
          </g>
          <g opacity="0.9">
            {NEURAL_FILAMENTS.map((filament) => (
              <path
                key={filament.id}
                className="galaxy-animate"
                d={filament.d}
                fill="none"
                stroke={filament.stroke}
                strokeOpacity={filament.opacity}
                strokeWidth={filament.width}
                strokeLinecap="round"
                strokeDasharray={filament.dash}
                filter="url(#lineGlow)"
                style={{ animation: `galaxy-synapse-flow ${filament.duration}s ease-in-out infinite` }}
              />
            ))}
          </g>
          <g opacity="0.86">
            {MEMORY_COMETS.map((comet, index) => (
              <path
                key={comet.id}
                className="galaxy-animate"
                d={comet.d}
                fill="none"
                stroke={comet.stroke}
                strokeOpacity={comet.opacity}
                strokeWidth={comet.width}
                strokeLinecap="round"
                strokeDasharray={comet.dash}
                filter="url(#lineGlow)"
                style={{ animation: `galaxy-comet-run ${comet.duration}s ease-in-out infinite`, animationDelay: `${index * -8}s` }}
              />
            ))}
          </g>
          <g className="galaxy-animate" style={{ transformBox: 'fill-box', transformOrigin: `${CENTER_X}px ${CENTER_Y}px`, animation: 'galaxy-orbit-reverse 132s linear infinite' }}>
            {SINGULARITY_HALOS.map((halo) => (
              <circle
                key={halo.id}
                className="galaxy-animate"
                cx={CENTER_X}
                cy={CENTER_Y}
                r={halo.r}
                fill="none"
                stroke={halo.color}
                strokeOpacity={halo.opacity}
                strokeWidth={halo.width}
                strokeDasharray={halo.dash}
                filter="url(#lineGlow)"
                style={{ transformBox: 'fill-box', transformOrigin: `${CENTER_X}px ${CENTER_Y}px`, animation: `galaxy-halo-phase ${halo.duration} linear infinite` }}
              />
            ))}
          </g>
          <g className="galaxy-animate" style={{ transformBox: 'fill-box', transformOrigin: `${CENTER_X}px ${CENTER_Y}px`, animation: 'galaxy-core-pulse 5.8s ease-in-out infinite' }}>
            <circle cx={CENTER_X} cy={CENTER_Y} r="86" fill="url(#coreGradient)" opacity="0.72" />
            <circle cx={CENTER_X} cy={CENTER_Y} r="34" fill="#ffffff" opacity="0.14" />
          </g>
          {visibleEdges.map(({ edge, source, target, index }) => (
            <path
              key={edge.id}
              className={index % 5 === 0 ? 'galaxy-animate' : undefined}
              d={curvedPath(source, target, index)}
              fill="none"
              stroke={edge.color || '#6f5bd7'}
              strokeOpacity={edge.relation === 'mentions_missing_wikilink' ? 0.34 : 0.25}
              strokeWidth={Math.max(0.7, Math.min(2.6, edge.weight || 1))}
              strokeDasharray={index % 5 === 0 ? '10 18' : undefined}
              filter="url(#lineGlow)"
              style={index % 5 === 0 ? { animation: `galaxy-trail-dash ${14 + (index % 9)}s linear infinite` } : undefined}
            />
          ))}
          {plottedNodes.map((node) => {
            const active = selected?.id === node.id || hovered?.id === node.id
            const labelVisible = node.type === 'agent' || node.type === 'project' || node.type === 'agent_group' || active
            const labelX = node.labelAnchor === 'start' ? node.x + node.r + 7 : node.labelAnchor === 'end' ? node.x - node.r - 7 : node.x
            return (
              <g key={node.id} onMouseEnter={() => setHovered(node)} onMouseLeave={() => setHovered(null)} onClick={() => setSelected(node)} className="cursor-pointer">
                <ellipse cx={node.x + node.r * 0.38} cy={node.y + node.r * 0.66} rx={node.r * 1.16} ry={node.r * 0.42} fill="#02010a" opacity={0.3 * node.depth} />
                <circle cx={node.x} cy={node.y} r={node.r + (active ? 15 : 8)} fill={node.color} opacity={(active ? 0.28 : 0.12) * node.depth} filter="url(#galaxyGlow)" />
                <circle cx={node.x} cy={node.y} r={node.r} fill={node.color} opacity={(node.type === 'missing_link_candidate' ? 0.76 : 0.98) * Math.max(0.56, node.depth)} stroke={active ? '#ffffff' : '#f7f1ff'} strokeOpacity={active ? 0.88 : 0.23} strokeWidth={active ? 2.2 : 0.8} filter="url(#galaxyGlow)" />
                <circle cx={node.x - node.r * 0.28} cy={node.y - node.r * 0.28} r={Math.max(1.2, node.r * 0.22)} fill="#fff" opacity={active ? 0.72 : 0.36} />
                {labelVisible && (
                  <text x={labelX} y={node.y + (node.labelAnchor === 'middle' ? node.r + 15 : 4)} fill="#f7f1ff" opacity={active ? 1 : 0.84} fontSize={active ? 13 : 10} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" textAnchor={node.labelAnchor} paintOrder="stroke" stroke="#03020a" strokeWidth="4">{truncate(node.label, active ? 34 : 24)}</text>
                )}
              </g>
            )
          })}
          {selectedPlotted && <circle cx={selectedPlotted.x} cy={selectedPlotted.y} r={selectedPlotted.r + 22} fill="none" stroke="#55f1ff" strokeOpacity="0.72" strokeWidth="2" strokeDasharray="6 10" />}
          <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill="url(#depthVignette)" pointerEvents="none" />
        </svg>
      </div>

      {!presentationMode && <div className="absolute left-4 top-32 z-20 grid w-56 gap-3">
        <StatCard label="Nodes" value={stats?.totalNodes || 0} tone="#9b5cff" />
        <StatCard label="Edges" value={stats?.totalEdges || 0} tone="#55f1ff" />
        <StatCard label="Agents" value={stats?.agents || 0} tone="#ff4fb8" />
        <StatCard label="Projects" value={stats?.projects || 0} tone="#61ffbd" />
        <StatCard label="Missing Links" value={stats?.missingLinks || 0} tone="#ffd166" />
      </div>}

      {!presentationMode && <div className="absolute right-4 top-32 z-20 w-80 rounded-3xl border border-white/10 bg-[#080615]/78 p-4 shadow-[0_0_44px_rgba(0,0,0,0.36)] backdrop-blur-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#a79bc9]/70">{view === 'missing-links' ? 'Missing Links Queue' : view === 'project-nexus' ? 'Project Nexus' : 'Inspector'}</div>
            <div className="mt-1 text-lg font-semibold leading-tight text-white">{view === 'inspector' ? selected?.label || 'No node selected' : view === 'missing-links' ? `${compact(stats?.missingLinks || 0)} candidates` : 'Project-centered slice'}</div>
          </div>
          {selected && view === 'inspector' && <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[10px] text-[#55f1ff]">{selected.type}</span>}
        </div>

        {view === 'inspector' && <div className="space-y-2 font-mono text-[11px] text-[#a79bc9]">
          <div className="flex justify-between gap-4"><span>Status</span><span className="text-[#f7f1ff]">{selected ? statusLabel(selected.status) : 'waiting'}</span></div>
          <div className="flex justify-between gap-4"><span>Degree</span><span className="text-[#f7f1ff]">{selected?.degree ?? '-'}</span></div>
          <div className="flex justify-between gap-4"><span>Artifact</span><span className="max-w-[180px] truncate text-[#f7f1ff]">{selected?.artifactId || '-'}</span></div>
          <div className="rounded-2xl border border-white/10 bg-black/24 p-3 text-[10px] leading-relaxed text-[#d8d0ef]">{displayPath(selected)}</div>
        </div>}

        {view === 'missing-links' && <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[#a79bc9]/70">
            <div className="rounded-xl border border-white/10 bg-black/20 p-2"><span className="block text-[#ffd166]">Cluster rank</span>diverse groups first</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2"><span className="block text-[#55f1ff]">Jump target</span>display only</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2"><span className="block text-[#ff4fb8]">Write guard</span>approval gated</div>
          </div>
          {missingQueue.map((node, index) => (
            <button key={node.id} onClick={() => setSelected(node)} className="w-full rounded-2xl border border-[#ffd166]/14 bg-[#ffd166]/7 p-2.5 text-left transition hover:border-[#ffd166]/40 hover:bg-[#ffd166]/12">
              <div className="flex items-center justify-between gap-2 font-mono text-[10px] text-[#ffd166]"><span>#{index + 1} · {relevanceBand(node)} · degree {node.degree}</span><span>{sourceDiversityLabel(node.sourceDiversity)}</span></div>
              <div className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-white">{node.label}</span><span className="shrink-0 rounded-full border border-[#ffd166]/20 px-2 py-0.5 font-mono text-[9px] text-[#ffd166]">{node.duplicateCount} refs · {node.sourceGroupCount} group</span></div>
              <div className="mt-1 truncate font-mono text-[9px] text-[#d8d0ef]">near {summarizeNeighborhood(node, nodesById, snapshot?.edges || [])}</div>
              <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-white/10 bg-black/22 px-2 py-1.5 font-mono text-[9px] text-[#a79bc9]">
                <span className="truncate"><span className="text-[#55f1ff]">{node.sourceGroup}</span> / {sourceJumpLabel(node)}</span>
                <span className="rounded-full bg-[#55f1ff]/10 px-2 py-0.5 text-[#dffcff]">source jump</span>
              </div>
            </button>
          ))}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-2 font-mono text-[10px] text-[#a79bc9]">Queue is ranked and grouped for operator triage only; no vault writes without approval.</div>
        </div>}

        {view === 'project-nexus' && <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[#a79bc9]/70">
            <div className="rounded-xl border border-white/10 bg-black/20 p-2"><span className="block text-[#61ffbd]">Projects</span>{projectNexusSummary.projects} hubs</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2"><span className="block text-[#55f1ff]">Operators</span>{projectNexusSummary.operators} agents</div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-2"><span className="block text-[#ff4fb8]">Active</span>{projectNexusSummary.active} live</div>
          </div>
          {projectNexus.map((node) => (
            <button key={node.id} onClick={() => { setSelected(node); fetchGalaxy('project', node.id) }} className="w-full rounded-2xl border border-[#55f1ff]/14 bg-[#55f1ff]/7 p-2 text-left transition hover:border-[#55f1ff]/40 hover:bg-[#55f1ff]/12">
              <div className="flex items-center justify-between gap-2"><span className="truncate text-xs text-white">{node.label}</span><span className="font-mono text-[10px] text-[#55f1ff]">{node.type}</span></div>
              <div className="mt-1 font-mono text-[9px] text-[#a79bc9]">degree {node.degree} · {statusLabel(node.status)}</div>
              <div className="mt-1 font-mono text-[9px] text-[#bdefff]">{node.directLinks} direct links · {node.relationMix}</div>
              <div className="mt-1 truncate font-mono text-[9px] text-[#d8d0ef]">near {node.neighborhood}</div>
              <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-white/10 bg-black/22 px-2 py-1.5 font-mono text-[9px] text-[#a79bc9]">
                <span className="truncate"><span className="text-[#61ffbd]">{node.sourceGroup}</span> / {node.sourceLabel}</span>
                <span className="rounded-full bg-[#61ffbd]/10 px-2 py-0.5 text-[#dfffee]">source jump</span>
              </div>
            </button>
          ))}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-2 font-mono text-[10px] text-[#a79bc9]">Drill-in redraws around selected project/agent using source-backed graph slice.</div>
        </div>}

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(snapshot?.actions || []).map((action) => (
            <button key={action.key} onClick={() => runAction(action.key)} disabled={action.status !== 'ready'} title={action.description} className={`rounded-xl border px-3 py-2 text-left font-mono text-[10px] transition-all ${action.status === 'ready' ? 'border-[#55f1ff]/30 bg-[#55f1ff]/10 text-[#dffcff] hover:bg-[#55f1ff]/20' : 'border-white/10 bg-white/5 text-[#a79bc9]/50'}`}>
              {action.label}<div className="mt-1 text-[8px] uppercase tracking-[0.18em] opacity-60">{action.status.replace('_', ' ')}</div>
            </button>
          ))}
        </div>
      </div>}

      {!presentationMode && <div className="absolute bottom-4 left-1/2 z-20 w-[52rem] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-3xl border border-white/10 bg-[#080615]/74 p-3 backdrop-blur-2xl">
        <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-[#a79bc9]/70"><span>Source Freshness / Activity</span><span>{stats?.visibleNodes || 0} visible / {stats?.visibleEdges || 0} links</span></div>
        <div className="grid grid-cols-5 gap-2">
          {(stats?.sourceFreshness || []).slice(0, 5).map((source, index) => (
            <div key={`${source.label}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-2">
              <div className="truncate font-mono text-[10px] text-[#f7f1ff]">{source.label}</div>
              <div className="mt-1 h-1.5 rounded-full bg-[#1f1a3f]"><div className="h-full rounded-full bg-[#55f1ff] shadow-[0_0_14px_rgba(85,241,255,0.6)]" style={{ width: source.exists ? '82%' : '18%' }} /></div>
              <div className="mt-1 truncate font-mono text-[9px] text-[#a79bc9]/60">{source.mtime || 'mtime pending'}</div>
            </div>
          ))}
        </div>
      </div>}

      {presentationMode && !demoMode && <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[#080615]/70 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#d8d0ef] backdrop-blur-xl">
        <span className="text-[#9b5cff]">{compact(stats?.totalNodes || 0)} nodes</span><span>·</span><span className="text-[#55f1ff]">{compact(stats?.totalEdges || 0)} edges</span><span>·</span><span className="text-[#ffd166]">{compact(stats?.missingLinks || 0)} missing links</span>
      </div>}

      {hovered && <div className="pointer-events-none absolute bottom-28 left-1/2 z-30 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#080615]/92 px-3 py-2 font-mono text-xs text-white shadow-[0_0_30px_rgba(155,92,255,0.25)] backdrop-blur-xl">{hovered.label} <span className="text-[#55f1ff]/70">{hovered.type}</span></div>}
    </div>
  )
}
