import { readFileSync, statSync } from 'fs'

const VISUAL_MEMORY_GRAPH_PATH = '/Users/vortexventures/Desktop/Vortex Ventures/_shared/vault/Graphs/VisualMemoryGraph/visual_memory_graph.seed.json'

type TopTuple = Array<[string, number]>

export interface VisualMemoryGraphSummary {
  generatedAt: number
  sourcePath: string
  sourceMtime: number
  schemaVersion: string
  stats: {
    nodeCount: number
    edgeCount: number
    hyperedgeCount: number
    artifactCount: number
    canonicalAgents: string[]
    canonicalProjects: string[]
    topNodeTypes: TopTuple
    topRelations: TopTuple
  }
  graph: VisualMemoryGraphPayload
}

export interface VisualMemoryGraphNode {
  id: string
  label?: string
  node_type?: string
  source_file?: string | null
  source_location?: string | null
  vault_path?: string | null
  artifact_id?: string
  role?: string
  status?: string
  confidence?: string
  confidence_score?: number
  tags?: string[]
  metrics?: { degree?: number; in_degree?: number; out_degree?: number }
}

export interface VisualMemoryGraphEdge {
  id?: string
  source: string
  target: string
  relation?: string
  confidence?: string
  confidence_score?: number
  weight?: number
  artifact_id?: string
}

export interface VisualMemoryGraphPayload {
  schema_version?: string
  generated_at?: string
  nodes?: VisualMemoryGraphNode[]
  edges?: VisualMemoryGraphEdge[]
  hyperedges?: unknown[]
  source_artifacts?: Array<{ artifact_id?: string; label?: string; path?: string; mtime?: string; exists?: boolean; node_count?: number }>
  stats?: {
    node_count?: number
    edge_count?: number
    hyperedge_count?: number
    artifact_count?: number
    canonical_agents?: string[]
    canonical_projects?: string[]
    top_node_types?: TopTuple
    top_relations?: TopTuple
  }
}

export interface MissionControlMemoryGraphAgentFile {
  path: string
  chunks: number
  textSize: number
}

export interface MissionControlMemoryGraphAgent {
  name: string
  dbSize: number
  totalChunks: number
  totalFiles: number
  files: MissionControlMemoryGraphAgentFile[]
}

export interface VisualGalaxyUiNode {
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

export interface VisualGalaxyUiEdge {
  id: string
  source: string
  target: string
  relation: string
  weight: number
  color: string
}

export interface VisualGalaxyUiSnapshot {
  generatedAt: number
  sourcePath: string
  mode: string
  selectedId: string | null
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
  filters: Array<{ key: string; label: string; count: number }>
  actions: Array<{ key: string; label: string; status: 'ready' | 'planned' | 'approval_required'; description: string }>
  nodes: VisualGalaxyUiNode[]
  edges: VisualGalaxyUiEdge[]
  selected: VisualGalaxyUiNode | null
}

function readVisualMemoryGraph(): { graph: VisualMemoryGraphPayload; sourceMtime: number } {
  const raw = readFileSync(VISUAL_MEMORY_GRAPH_PATH, 'utf8')
  const graph = JSON.parse(raw) as VisualMemoryGraphPayload
  const sourceStat = statSync(VISUAL_MEMORY_GRAPH_PATH)
  return { graph, sourceMtime: sourceStat.mtimeMs }
}

export function getVisualMemoryGraphSnapshot(): VisualMemoryGraphSummary {
  const { graph, sourceMtime } = readVisualMemoryGraph()

  return {
    generatedAt: Date.now(),
    sourcePath: VISUAL_MEMORY_GRAPH_PATH,
    sourceMtime,
    schemaVersion: graph.schema_version || 'unknown',
    stats: {
      nodeCount: graph.stats?.node_count || 0,
      edgeCount: graph.stats?.edge_count || 0,
      hyperedgeCount: graph.stats?.hyperedge_count || 0,
      artifactCount: graph.stats?.artifact_count || 0,
      canonicalAgents: graph.stats?.canonical_agents || [],
      canonicalProjects: graph.stats?.canonical_projects || [],
      topNodeTypes: graph.stats?.top_node_types || [],
      topRelations: graph.stats?.top_relations || [],
    },
    graph,
  }
}

function agentNodeId(name: string): string {
  return `agent::${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`
}

export function getMissionControlMemoryGraphAgentsFromVisualGraph(): { generatedAt: number; sourcePath: string; agents: MissionControlMemoryGraphAgent[] } {
  const { graph } = readVisualMemoryGraph()
  const nodes = graph.nodes || []
  const edges = graph.edges || []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const canonicalAgents = graph.stats?.canonical_agents || []

  const agents = canonicalAgents.map((agentName): MissionControlMemoryGraphAgent => {
    const id = agentNodeId(agentName)
    const linkedIds = new Set<string>()

    for (const edge of edges) {
      if (edge.relation !== 'documented_by' && edge.relation !== 'manages' && edge.relation !== 'member_of') continue
      if (edge.source === id) linkedIds.add(edge.target)
      if (edge.target === id) linkedIds.add(edge.source)
    }

    const agentNode = byId.get(id)
    const linkedNodes = Array.from(linkedIds)
      .map((nodeId) => byId.get(nodeId))
      .filter((node): node is VisualMemoryGraphNode => Boolean(node))
      .sort((a, b) => (b.metrics?.degree || 0) - (a.metrics?.degree || 0))
      .slice(0, 120)

    const files: MissionControlMemoryGraphAgentFile[] = linkedNodes.map((node) => {
      const path = node.vault_path || node.source_file || node.label || node.id
      const chunks = Math.max(1, Math.round((node.metrics?.degree || 1) / 3))
      const textSize = Math.max(256, path.length * 42)
      return { path, chunks, textSize }
    })

    if (files.length === 0 && agentNode) {
      files.push({ path: `${agentName} canonical agent node — ${agentNode.role || 'role captured in Visual Memory Graph'}`, chunks: Math.max(1, agentNode.metrics?.degree || 1), textSize: 512 })
    }

    return {
      name: agentName,
      dbSize: files.reduce((sum, file) => sum + file.textSize, 0),
      totalChunks: files.reduce((sum, file) => sum + file.chunks, 0),
      totalFiles: files.length,
      files,
    }
  })

  return {
    generatedAt: Date.now(),
    sourcePath: VISUAL_MEMORY_GRAPH_PATH,
    agents,
  }
}

function nodeStatus(node: VisualMemoryGraphNode): VisualGalaxyUiNode['status'] {
  const label = `${node.label || ''} ${node.node_type || ''}`.toLowerCase()
  if (node.node_type === 'missing_link_candidate') return 'missing_link'
  if (label.includes('blocker') || label.includes('failed') || label.includes('error')) return 'stale'
  if (node.node_type === 'agent' || node.node_type === 'project') return 'active'
  if (node.confidence === 'PLANNED') return 'planned'
  return 'verified'
}

function nodeColor(type: string, status: VisualGalaxyUiNode['status']): string {
  if (status === 'missing_link') return '#ffd166'
  if (status === 'stale') return '#ff4d6d'
  if (type === 'agent') return '#ff4fb8'
  if (type === 'project') return '#55f1ff'
  if (type === 'research_note') return '#ffd166'
  if (type === 'receipt') return '#dce8ff'
  if (type === 'decision') return '#61ffbd'
  if (type === 'code') return '#8fb8ff'
  return '#9b5cff'
}

function toUiNode(node: VisualMemoryGraphNode): VisualGalaxyUiNode {
  const type = node.node_type || 'unknown'
  const status = nodeStatus(node)
  const degree = node.metrics?.degree || 0
  const sizeBase = type === 'agent' ? 22 : type === 'project' ? 20 : type === 'agent_group' ? 18 : type === 'missing_link_candidate' ? 8 : 7
  const size = Math.min(36, sizeBase + Math.sqrt(Math.max(degree, 0)) * (type === 'agent' || type === 'project' ? 0.75 : 0.35))
  const color = nodeColor(type, status)
  return {
    id: node.id,
    label: node.label || node.id,
    type,
    artifactId: node.artifact_id || 'unknown',
    sourcePath: node.source_file || null,
    vaultPath: node.vault_path || null,
    degree,
    status,
    color,
    size,
    glow: status === 'stale' ? '#ff4d6d' : color,
    tags: node.tags || [],
  }
}

function countNodes(nodes: VisualMemoryGraphNode[], type: string): number {
  return nodes.filter((node) => node.node_type === type).length
}

function rankNode(node: VisualMemoryGraphNode): number {
  const degree = node.metrics?.degree || 0
  const typeBoost = node.node_type === 'agent' ? 100000 : node.node_type === 'project' ? 90000 : node.node_type === 'missing_link_candidate' ? 3000 : node.node_type === 'receipt' ? 2000 : 0
  return typeBoost + degree
}

function selectNodeSlice(nodes: VisualMemoryGraphNode[], edges: VisualMemoryGraphEdge[], mode: string, selectedId: string | null, limit: number): Set<string> {
  const ids = new Set<string>()
  const canonical = nodes.filter((node) => node.node_type === 'agent' || node.node_type === 'project' || node.node_type === 'agent_group')
  canonical.forEach((node) => ids.add(node.id))

  let pool = nodes
  if (mode === 'missing-links') pool = nodes.filter((node) => node.node_type === 'missing_link_candidate')
  if (mode === 'research') pool = nodes.filter((node) => node.node_type === 'research_note')
  if (mode === 'agent') pool = nodes.filter((node) => node.node_type === 'agent' || node.node_type === 'agent_note' || node.id === selectedId)
  if (mode === 'project') pool = nodes.filter((node) => node.node_type === 'project' || node.node_type === 'project_note' || node.id === selectedId)

  pool.sort((a, b) => rankNode(b) - rankNode(a)).slice(0, limit).forEach((node) => ids.add(node.id))

  if (selectedId) {
    ids.add(selectedId)
    for (const edge of edges) {
      if (edge.source === selectedId) ids.add(edge.target)
      if (edge.target === selectedId) ids.add(edge.source)
      if (ids.size > limit + 120) break
    }
  }

  return ids
}

export function getVisualGalaxyUiSnapshot({ mode = 'overview', selectedId = null, limit = 360 }: { mode?: string; selectedId?: string | null; limit?: number }): VisualGalaxyUiSnapshot {
  const { graph } = readVisualMemoryGraph()
  const nodes = graph.nodes || []
  const edges = graph.edges || []
  const boundedLimit = Math.max(60, Math.min(Number.isFinite(limit) ? limit : 360, 900))
  const selectedNodeId = selectedId || null
  const selectedIds = selectNodeSlice([...nodes], edges, mode, selectedNodeId, boundedLimit)
  const uiNodes = nodes.filter((node) => selectedIds.has(node.id)).map(toUiNode)
  const visibleIdSet = new Set(uiNodes.map((node) => node.id))
  const uiEdges = edges
    .filter((edge) => visibleIdSet.has(edge.source) && visibleIdSet.has(edge.target))
    .slice(0, Math.max(120, boundedLimit * 3))
    .map((edge, index): VisualGalaxyUiEdge => ({
      id: edge.id || `edge-${index}`,
      source: edge.source,
      target: edge.target,
      relation: edge.relation || 'related_to',
      weight: edge.weight || 1,
      color: edge.relation === 'mentions_missing_wikilink' ? '#ffd166' : '#6f5bd7',
    }))
  const selected = selectedNodeId ? uiNodes.find((node) => node.id === selectedNodeId) || null : uiNodes.find((node) => node.type === 'project') || uiNodes[0] || null
  const sourceFreshness = (graph.source_artifacts || []).map((artifact) => ({ label: artifact.label || artifact.artifact_id || 'Unknown source', mtime: artifact.mtime || null, exists: artifact.exists !== false }))

  return {
    generatedAt: Date.now(),
    sourcePath: VISUAL_MEMORY_GRAPH_PATH,
    mode,
    selectedId: selectedNodeId,
    stats: {
      totalNodes: graph.stats?.node_count || nodes.length,
      totalEdges: graph.stats?.edge_count || edges.length,
      visibleNodes: uiNodes.length,
      visibleEdges: uiEdges.length,
      agents: countNodes(nodes, 'agent'),
      projects: countNodes(nodes, 'project'),
      missingLinks: countNodes(nodes, 'missing_link_candidate'),
      receipts: countNodes(nodes, 'receipt'),
      research: countNodes(nodes, 'research_note'),
      sourceArtifacts: graph.source_artifacts?.length || graph.stats?.artifact_count || 0,
      sourceFreshness,
    },
    filters: [
      { key: 'overview', label: 'Overview', count: graph.stats?.node_count || nodes.length },
      { key: 'agent', label: 'Agents', count: countNodes(nodes, 'agent') },
      { key: 'project', label: 'Projects', count: countNodes(nodes, 'project') },
      { key: 'research', label: 'Research', count: countNodes(nodes, 'research_note') },
      { key: 'receipts', label: 'Receipts', count: countNodes(nodes, 'receipt') },
      { key: 'missing-links', label: 'Missing Links', count: countNodes(nodes, 'missing_link_candidate') },
    ],
    actions: [
      { key: 'analyze', label: 'Analyze', status: 'ready', description: 'Read-only selected-node neighborhood summary with source paths.' },
      { key: 'missing-links', label: 'Missing Links', status: 'ready', description: 'Ranked candidates from raw missing wikilinks; writes still approval-gated.' },
      { key: 'project-nexus', label: 'Project Nexus', status: 'ready', description: 'Project-centered slice across agents, proof, code, and research.' },
      { key: 'open-source', label: 'Open Source', status: 'approval_required', description: 'Source opening/copying must respect local file boundaries.' },
    ],
    nodes: uiNodes,
    edges: uiEdges,
    selected,
  }
}
