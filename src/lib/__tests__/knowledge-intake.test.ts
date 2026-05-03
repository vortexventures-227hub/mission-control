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
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('knowledge intake', () => {
  it('detects supported source types', () => {
    expect(mod.detectKnowledgeSourceType('https://www.youtube.com/watch?v=abc')).toBe('youtube')
    expect(mod.detectKnowledgeSourceType('https://youtu.be/abc')).toBe('youtube')
    expect(mod.detectKnowledgeSourceType('https://x.com/example/status/1')).toBe('x')
    expect(mod.detectKnowledgeSourceType('https://example.com/research.pdf')).toBe('pdf')
    expect(mod.detectKnowledgeSourceType('https://example.com/article')).toBe('article')
    expect(mod.detectKnowledgeSourceType('Graphify should stage memory writes for approval.')).toBe('paste')
  })

  it('captures pasted text with raw and extracted paths plus review fields', () => {
    const snapshot = mod.createKnowledgeSource({
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

  it('captures URL scaffolds honestly when full extraction is not available', () => {
    const snapshot = mod.createKnowledgeSource({
      content: 'https://x.com/example/status/123',
      project_scope: 'Research Command',
    })

    expect(snapshot.source.source_type).toBe('x')
    expect(snapshot.source.status).toBe('credentials_needed')
    expect(snapshot.source.error).toContain('Credentials Needed')
    expect(snapshot.extraction.summary).toContain('captured')
    expect(fs.readFileSync(snapshot.source.raw_path, 'utf8')).toContain('x.com')
  })

  it('keeps durable learning actions approval gated', () => {
    const snapshot = mod.createKnowledgeSource({
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
