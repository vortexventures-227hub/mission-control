import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let tempDir = ''
let mod: typeof import('../knowledge-intake')

beforeEach(async () => {
  vi.resetModules()
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-knowledge-intake-'))
  process.env.MISSION_CONTROL_DATA_DIR = tempDir
  mod = await import('../knowledge-intake')
})

afterEach(() => {
  delete process.env.MISSION_CONTROL_DATA_DIR
  vi.unstubAllGlobals()
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('knowledge intake', () => {
  it('detects supported source types', () => {
    expect(mod.detectKnowledgeSourceType('https://www.youtube.com/watch?v=abc')).toBe('youtube')
    expect(mod.detectKnowledgeSourceType('https://youtu.be/abc')).toBe('youtube')
    expect(mod.detectKnowledgeSourceType('https://x.com/example/status/1')).toBe('x')
    expect(mod.detectKnowledgeSourceType('https://www.reddit.com/r/LocalLLaMA/comments/abc/example')).toBe('reddit')
    expect(mod.detectKnowledgeSourceType('https://redd.it/abc123')).toBe('reddit')
    expect(mod.detectKnowledgeSourceType('https://example.com/research.pdf')).toBe('pdf')
    expect(mod.detectKnowledgeSourceType('https://example.com/article')).toBe('article')
    expect(mod.detectKnowledgeSourceType('Graphify should stage memory writes for approval.')).toBe('paste')
  })

  it('captures pasted text with raw and extracted paths plus review fields', async () => {
    const snapshot = await mod.createKnowledgeSource({
      content: [
        'Mission Control needs Knowledge Intake so Chris can paste research without losing context.',
        'Graphify and Brain writes must require approval and receipts.',
        'Build review cards with summary, key ideas, implementation steps, and claims to verify.',
      ].join('\n'),
      project_scope: 'Mission Control',
      context_note: 'first slice test',
    })

    expect(snapshot.source.source_type).toBe('paste')
    expect(snapshot.source.status).toBe('ready_for_review')
    expect(fs.existsSync(snapshot.source.raw_path)).toBe(true)
    expect(fs.existsSync(snapshot.source.extracted_text_path || '')).toBe(true)
    expect(snapshot.extraction.summary).toContain('Mission Control')
    expect(snapshot.extraction.key_ideas.length).toBeGreaterThan(0)
    expect(snapshot.extraction.tools_mentioned).toContain('Graphify')
    expect(snapshot.extraction.implementation_steps.length).toBeGreaterThan(0)
    expect(snapshot.extraction.claims_to_verify.length).toBeGreaterThan(0)
  })

  it('extracts MCP and plugin labels for review cards', async () => {
    const snapshot = await mod.createKnowledgeSource({
      content: [
        'Use the GitHub MCP server to read repository issues before implementing the change.',
        'Connect the Linear plugin after approval so task context remains visible.',
        'Never write Wiki or Brain memory silently.',
      ].join('\n'),
      project_scope: 'Mission Control',
    })

    expect(snapshot.source.status).toBe('ready_for_review')
    expect(snapshot.extraction.mcp_servers).toContain('GitHub MCP server')
    expect(snapshot.extraction.plugins_mentioned).toContain('Linear plugin')
    expect(snapshot.extraction.claims_to_verify.join(' ')).toContain('Never write')
  })

  it('captures Reddit URL scaffolds without pretending extraction succeeded', async () => {
    const snapshot = await mod.createKnowledgeSource({
      content: 'https://www.reddit.com/r/LocalLLaMA/comments/abc/example',
      project_scope: 'Research Command',
    })

    expect(snapshot.source.source_type).toBe('reddit')
    expect(snapshot.source.status).toBe('captured')
    expect(snapshot.extraction.summary).toContain('Reddit URL captured')
    expect(snapshot.extraction.key_ideas).toContain('Reddit source captured with citation preserved.')
    expect(snapshot.extraction.recommended_destinations).toContain('General Vortex Wiki')
    expect(fs.readFileSync(snapshot.source.raw_path, 'utf8')).toContain('reddit.com')
  })

  it('captures URL scaffolds honestly when full extraction is not available', async () => {
    const snapshot = await mod.createKnowledgeSource({
      content: 'https://x.com/example/status/123',
      project_scope: 'Research Command',
    })

    expect(snapshot.source.source_type).toBe('x')
    expect(snapshot.source.status).toBe('credentials_needed')
    expect(snapshot.source.error).toContain('Credentials Needed')
    expect(snapshot.extraction.summary).toContain('captured')
    expect(fs.readFileSync(snapshot.source.raw_path, 'utf8')).toContain('x.com')
  })

  it('extracts public article pages into review-ready source cards', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`
      <html>
        <head>
          <title>Mission Control Article</title>
          <meta name="author" content="Herm Edwards">
        </head>
        <body>
          <article>
            <h1>Mission Control Article</h1>
            <p>Mission Control needs article intake so operators can turn useful public pages into reviewable source cards.</p>
            <p>Build extraction around citations, raw receipts, approval gates, and careful claims that can be verified before durable memory writes.</p>
            <p>Verify that Graphify, Brain, and Wiki destinations remain approval gated before any source becomes permanent operating memory.</p>
          </article>
        </body>
      </html>`, { headers: { 'content-type': 'text/html' } })))

    const snapshot = await mod.createKnowledgeSource({
      content: 'https://example.com/mission-control-article',
      project_scope: 'Mission Control',
    })

    expect(snapshot.source.source_type).toBe('article')
    expect(snapshot.source.status).toBe('ready_for_review')
    expect(snapshot.source.title).toBe('Mission Control Article')
    expect(snapshot.source.author).toBe('Herm Edwards')
    expect(snapshot.extraction.summary).toContain('Mission Control')
    expect(fs.readFileSync(snapshot.source.extracted_text_path || '', 'utf8')).toContain('approval gates')
  })

  it('keeps failed article extraction honest without invented summaries', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Nope', { status: 403 })))

    const snapshot = await mod.createKnowledgeSource({
      content: 'https://example.com/blocked-article',
      project_scope: 'Research Command',
    })

    expect(snapshot.source.source_type).toBe('article')
    expect(snapshot.source.status).toBe('error')
    expect(snapshot.source.error).toContain('extraction_failed')
    expect(snapshot.extraction.summary).toContain('not reachable')
    expect(fs.readFileSync(snapshot.source.extracted_text_path || '', 'utf8')).toContain('extraction_failed')
  })

  it('extracts available YouTube caption tracks into review-ready cards', async () => {
    const player = {
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ languageCode: 'en', baseUrl: 'https://example.com/transcript.xml' }],
        },
      },
    }
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('youtube.com')) {
        return new Response(`<script>var ytInitialPlayerResponse = ${JSON.stringify(player)};</script>`, {
          headers: { 'content-type': 'text/html' },
        })
      }
      return new Response(`
        <transcript>
          <text start="0">Mission Control captures YouTube transcripts for operator review.</text>
          <text start="5">Build citations, claims to verify, approval gates, and Graphify destination requests.</text>
          <text start="10">Never write durable memory without a human approval receipt.</text>
        </transcript>`, { headers: { 'content-type': 'text/xml' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await mod.createKnowledgeSource({
      content: 'https://www.youtube.com/watch?v=abc123',
      project_scope: 'Mission Control',
    })

    expect(snapshot.source.source_type).toBe('youtube')
    expect(snapshot.source.status).toBe('ready_for_review')
    expect(snapshot.source.error).toBeNull()
    expect(snapshot.extraction.summary).toContain('Mission Control')
    expect(fs.readFileSync(snapshot.source.extracted_text_path || '', 'utf8')).toContain('YouTube transcripts')
  })

  it('marks YouTube transcript unavailable when captions are absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<script>var ytInitialPlayerResponse = {};</script>', {
      headers: { 'content-type': 'text/html' },
    })))

    const snapshot = await mod.createKnowledgeSource({
      content: 'https://www.youtube.com/watch?v=no-captions',
      project_scope: 'Mission Control',
    })

    expect(snapshot.source.source_type).toBe('youtube')
    expect(snapshot.source.status).toBe('manual_paste_needed')
    expect(snapshot.source.error).toContain('transcript_unavailable')
    expect(snapshot.extraction.summary).toContain('captions')
  })

  it('keeps durable learning actions approval gated', async () => {
    const snapshot = await mod.createKnowledgeSource({
      content: 'Create a task only after operator approval. Graphify should not be written silently.',
      project_scope: 'Blackwire Ops',
    })

    const receipt = mod.requestKnowledgeLearningAction(snapshot.source.id, 'Task Board')
    expect(receipt.status).toBe('approval_required')
    expect(receipt.files_written).toEqual([])
    expect(receipt.tasks_created).toEqual([])
    expect(receipt.reason).toContain('Approval Required')
  })
})
