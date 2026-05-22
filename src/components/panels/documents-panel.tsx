'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { BoundaryBanner, Chip, HudPanel, Page, Stat } from '@/components/mc/hud'

interface DocsTreeNode {
  path: string
  name: string
  type: 'file' | 'directory'
  size?: number
  modified?: number
  children?: DocsTreeNode[]
}

interface DocsTreeResponse {
  roots: string[]
  tree: DocsTreeNode[]
  error?: string
}

interface DocsContentResponse {
  path: string
  content: string
  size: number
  modified: number
  error?: string
}

interface DocsSearchResult {
  path: string
  name: string
  matches: number
}

interface DocsSearchResponse {
  results: DocsSearchResult[]
  error?: string
}

function collectFilePaths(nodes: DocsTreeNode[]): string[] {
  const filePaths: string[] = []
  for (const node of nodes) {
    if (node.type === 'file') {
      filePaths.push(node.path)
      continue
    }
    if (node.children && node.children.length > 0) {
      filePaths.push(...collectFilePaths(node.children))
    }
  }
  return filePaths
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString()
}

export function DocumentsPanel() {
  const t = useTranslations('documents')
  const [tree, setTree] = useState<DocsTreeNode[]>([])
  const [roots, setRoots] = useState<string[]>([])
  const [loadingTree, setLoadingTree] = useState(true)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [docContent, setDocContent] = useState<string>('')
  const [docMeta, setDocMeta] = useState<{ size: number; modified: number } | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DocsSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  const loadTree = useCallback(async () => {
    setLoadingTree(true)
    setTreeError(null)
    try {
      const res = await fetch('/api/docs/tree')
      const data = (await res.json()) as DocsTreeResponse
      if (!res.ok) throw new Error(data.error || 'Failed to load documents')

      setTree(data.tree || [])
      setRoots(data.roots || [])
      const defaultExpanded = new Set<string>((data.roots || []).filter(Boolean))
      setExpandedDirs(defaultExpanded)
    } catch (error) {
      setTree([])
      setRoots([])
      setTreeError((error as Error).message || 'Failed to load documents')
    } finally {
      setLoadingTree(false)
    }
  }, [])

  const loadDoc = useCallback(async (path: string) => {
    setLoadingDoc(true)
    setDocError(null)
    setSelectedPath(path)
    try {
      const res = await fetch(`/api/docs/content?path=${encodeURIComponent(path)}`)
      const data = (await res.json()) as DocsContentResponse
      if (!res.ok) throw new Error(data.error || 'Failed to load document')
      setDocContent(data.content || '')
      setDocMeta({ size: data.size, modified: data.modified })
    } catch (error) {
      setDocContent('')
      setDocMeta(null)
      setDocError((error as Error).message || 'Failed to load document')
    } finally {
      setLoadingDoc(false)
    }
  }, [])

  useEffect(() => {
    void loadTree()
  }, [loadTree])

  const filePaths = useMemo(() => collectFilePaths(tree), [tree])

  useEffect(() => {
    if (selectedPath) return
    if (filePaths.length === 0) return
    void loadDoc(filePaths[0])
  }, [filePaths, loadDoc, selectedPath])

  useEffect(() => {
    const query = searchQuery.trim()
    if (query.length < 2) {
      setSearchResults([])
      setSearchError(null)
      setSearching(false)
      return
    }

    const handle = setTimeout(async () => {
      setSearching(true)
      setSearchError(null)
      try {
        const res = await fetch(`/api/docs/search?q=${encodeURIComponent(query)}&limit=100`)
        const data = (await res.json()) as DocsSearchResponse
        if (!res.ok) throw new Error(data.error || 'Failed to search docs')
        setSearchResults(data.results || [])
      } catch (error) {
        setSearchResults([])
        setSearchError((error as Error).message || 'Failed to search docs')
      } finally {
        setSearching(false)
      }
    }, 250)

    return () => clearTimeout(handle)
  }, [searchQuery])

  const isShowingSearch = searchQuery.trim().length >= 2

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderNode = (node: DocsTreeNode, depth = 0) => {
    if (node.type === 'directory') {
      const isOpen = expandedDirs.has(node.path)
      return (
        <div key={node.path}>
          <button
            onClick={() => toggleDir(node.path)}
            className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary text-left"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <span className="text-xs text-muted-foreground">{isOpen ? '▾' : '▸'}</span>
            <span className="text-sm text-foreground">{node.name}</span>
          </button>
          {isOpen && node.children && (
            <div>
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      )
    }

    const active = selectedPath === node.path
    return (
      <button
        key={node.path}
        onClick={() => void loadDoc(node.path)}
        className={`w-full text-left py-1.5 px-2 rounded-md text-sm ${
          active ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-secondary'
        }`}
        style={{ paddingLeft: `${depth * 16 + 26}px` }}
      >
        {node.name}
      </button>
    )
  }

  return (
    <Page
      kicker="Blackwire Ops / Receipts & Docs"
      title={t('title')}
      subtitle="Read-only document library for receipts, handoffs, specs, and operator reference material. Search and preview preserve source paths instead of inventing status."
      badges={
        <>
          <Chip tone="teal">read only</Chip>
          <Chip tone="dim">{filePaths.length} files</Chip>
          <Chip tone={treeError || docError ? 'rose' : 'amber'}>{treeError || docError ? 'load warning' : 'provenance visible'}</Chip>
        </>
      }
    >
      <div className="space-y-4">
        <BoundaryBanner tone="teal" title="Document boundary">
          This surface reads local document roots and renders selected files for review. It does not edit source files, mark receipts verified, or write Memory/Graphify records.
        </BoundaryBanner>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="Files Indexed" value={filePaths.length} sub={`${roots.length} roots`} />
          <Stat label="Search Hits" value={searchResults.length} sub={isShowingSearch ? searchQuery.trim() : 'idle'} accent={isShowingSearch ? 'teal' : 'dim'} />
          <Stat label="Selected" value={selectedPath ? 'YES' : 'NONE'} sub={selectedPath ? selectedPath.split('/').pop() : t('selectFile')} accent={selectedPath ? 'purple' : 'dim'} />
          <Stat label="Mode" value="READ" sub="no file writes" accent="teal" glow />
        </section>

        <div className="grid min-h-[600px] grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <HudPanel kicker="document index" title="Library" className="min-h-[600px]" padded={false}>
            <aside className="h-full space-y-3 overflow-y-auto p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs font-black uppercase tracking-[0.14em] text-[color:var(--mc-ink-0)]">Source Tree</h2>
            <button
              onClick={() => void loadTree()}
              className="border border-[color:var(--mc-hairline)] bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--mc-ink-2)] hover:border-[color:var(--mc-teal)]/60 hover:text-[color:var(--mc-teal)]"
            >
              {t('refresh')}
            </button>
          </div>

          <div className="space-y-1">
            <label htmlFor="docs-search" className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--mc-ink-2)]">{t('searchLabel')}</label>
            <input
              id="docs-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-9 w-full border border-[color:var(--mc-hairline)] bg-black/25 px-3 font-mono text-xs text-[color:var(--mc-ink-0)] placeholder:text-[color:var(--mc-ink-3)] outline-none focus:border-[color:var(--mc-teal)]/70"
            />
          </div>

          {roots.length > 0 && (
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--mc-ink-2)]">
              Roots: {roots.join(', ')}
            </div>
          )}

          {loadingTree && (
            <div className="text-sm text-[color:var(--mc-ink-2)]">{t('loading')}</div>
          )}

          {treeError && (
            <BoundaryBanner tone="rose" title="Document tree failed">{treeError}</BoundaryBanner>
          )}

          {!loadingTree && !treeError && isShowingSearch && (
            <div className="space-y-1">
              {searching && <div className="text-sm text-[color:var(--mc-ink-2)]">{t('searching')}</div>}
              {searchError && <BoundaryBanner tone="rose" title="Search failed">{searchError}</BoundaryBanner>}
              {!searching && !searchError && searchResults.length === 0 && (
                <div className="text-sm text-[color:var(--mc-ink-2)]">{t('noMatches')}</div>
              )}
              {!searching && !searchError && searchResults.map((result) => (
                <button
                  key={result.path}
                  onClick={() => void loadDoc(result.path)}
                  className={`w-full text-left p-2 rounded-md border ${
                    selectedPath === result.path
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-border hover:bg-secondary'
                  }`}
                >
                  <div className="text-sm text-foreground truncate">{result.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{result.path}</div>
                  <div className="text-2xs text-muted-foreground mt-0.5">{result.matches} matches</div>
                </button>
              ))}
            </div>
          )}

          {!loadingTree && !treeError && !isShowingSearch && (
            <div className="space-y-1">
              {tree.length === 0 && (
                <div className="text-sm text-[color:var(--mc-ink-2)]">
                  {t('noRootsFound')}
                </div>
              )}
              {tree.map((node) => renderNode(node))}
            </div>
          )}
            </aside>
          </HudPanel>

          <HudPanel kicker="read-only preview" title={t('viewerTitle')} className="min-h-[600px]" padded={false} glow>
            <section className="h-full overflow-y-auto p-4 md:p-6">
              <p className="mb-4 text-xs leading-5 text-[color:var(--mc-ink-2)]">{t('viewerDescription')}</p>

          {!selectedPath && (
            <div className="text-sm text-[color:var(--mc-ink-2)]">{t('selectFile')}</div>
          )}

          {selectedPath && (
            <div className="space-y-3">
              <div className="border border-[color:var(--mc-hairline)] bg-black/25 px-3 py-2">
                <div className="break-all font-mono text-sm font-medium text-[color:var(--mc-ink-0)]">{selectedPath}</div>
                {docMeta && (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--mc-ink-2)]">
                    {formatBytes(docMeta.size)} • {t('updated')} {formatTime(docMeta.modified)}
                  </div>
                )}
              </div>

              {loadingDoc && <div className="text-sm text-[color:var(--mc-ink-2)]">{t('loadingDocument')}</div>}
              {docError && <BoundaryBanner tone="rose" title="Document failed">{docError}</BoundaryBanner>}

              {!loadingDoc && !docError && (
                <div className="border border-[color:var(--mc-hairline)] bg-black/25 p-4">
                  <MarkdownRenderer content={docContent} />
                </div>
              )}
            </div>
          )}
            </section>
          </HudPanel>
        </div>
      </div>
    </Page>
  )
}
