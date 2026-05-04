import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config, ensureDirExists } from './config'

export type KnowledgeSourceType = 'youtube' | 'x' | 'article' | 'pdf' | 'paste' | 'file' | 'folder'
export type KnowledgeSourceStatus =
  | 'captured'
  | 'extracted'
  | 'extracting'
  | 'summarized'
  | 'ready_for_review'
  | 'learned'
  | 'blocked'
  | 'error'
  | 'credentials_needed'
  | 'manual_paste_needed'

export interface KnowledgeSource {
  id: string
  workspace_id: number
  source_type: KnowledgeSourceType
  source_url: string | null
  title: string
  author: string | null
  captured_at: number
  raw_path: string
  extracted_text_path: string | null
  status: KnowledgeSourceStatus
  error: string | null
  tags: string[]
  project_scope: string
  context_note: string | null
}

export interface KnowledgeExtraction {
  source_id: string
  summary: string
  key_ideas: string[]
  tools_mentioned: string[]
  implementation_steps: string[]
  claims_to_verify: string[]
  recommended_destinations: string[]
  citations: Array<{ label: string; url?: string; path?: string }>
}

export interface KnowledgeLearningReceipt {
  id: string
  source_id: string
  destination: string
  status: 'approval_required' | 'approved' | 'written' | 'blocked'
  files_written: string[]
  tasks_created: string[]
  approval_id: string | null
  created_at: number
  reason: string
}

export interface KnowledgeIntakeStore {
  sources: KnowledgeSource[]
  extractions: KnowledgeExtraction[]
  learning_receipts: KnowledgeLearningReceipt[]
}

export interface CreateKnowledgeSourceInput {
  content: string
  context_note?: string
  project_scope?: string
  tags?: string[]
  workspace_id?: number
}

export interface KnowledgeIntakeSnapshot {
  generatedAt: number
  guardrails: string[]
  detection: {
    source_type: KnowledgeSourceType
    label: string
    extraction_status: KnowledgeSourceStatus
    extraction_note: string
  }
  source: KnowledgeSource
  extraction: KnowledgeExtraction
  recent_sources: Array<KnowledgeSource & { extraction?: KnowledgeExtraction }>
  gates: Array<{ action: string; status: 'available' | 'approval_required' | 'blocked'; detail: string }>
}

const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  youtube: 'YouTube',
  x: 'X / Twitter',
  article: 'Article / Web',
  pdf: 'PDF / File',
  paste: 'Pasted Text',
  file: 'File',
  folder: 'Folder',
}

const STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'being', 'between', 'could', 'every', 'from',
  'have', 'into', 'just', 'like', 'more', 'need', 'only', 'over', 'should', 'that', 'their', 'there',
  'these', 'thing', 'this', 'through', 'with', 'would', 'your',
])

const FETCH_TIMEOUT_MS = 10_000
const MAX_EXTRACTED_CHARS = 40_000

interface SummarizeResult {
  status: KnowledgeSourceStatus
  text: string
  extractedText: string
  extraction: Omit<KnowledgeExtraction, 'source_id' | 'citations'>
  error: string | null
  title?: string
  author?: string | null
}

interface ExternalExtractionResult {
  status: KnowledgeSourceStatus
  extractedText: string
  note: string
  error: string | null
  title?: string
  author?: string | null
}

function dataRoot() {
  return path.join(config.dataDir, 'knowledge-intake')
}

function storePath() {
  return path.join(dataRoot(), 'knowledge-intake-store.json')
}

function rawDir() {
  return path.join(dataRoot(), 'raw')
}

function extractedDir() {
  return path.join(dataRoot(), 'extracted')
}

function emptyStore(): KnowledgeIntakeStore {
  return { sources: [], extractions: [], learning_receipts: [] }
}

function readStore(): KnowledgeIntakeStore {
  ensureDirExists(dataRoot())
  const file = storePath()
  if (!fs.existsSync(file)) return emptyStore()
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<KnowledgeIntakeStore>
    return {
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      extractions: Array.isArray(parsed.extractions) ? parsed.extractions : [],
      learning_receipts: Array.isArray(parsed.learning_receipts) ? parsed.learning_receipts : [],
    }
  } catch {
    return emptyStore()
  }
}

function writeStore(store: KnowledgeIntakeStore) {
  ensureDirExists(dataRoot())
  fs.writeFileSync(storePath(), `${JSON.stringify(store, null, 2)}\n`)
}

function safeSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'source'
}

function isUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function detectKnowledgeSourceType(input: string): KnowledgeSourceType {
  const value = input.trim()
  if (!isUrl(value)) return 'paste'
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  const pathname = url.pathname.toLowerCase()
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube'
  if (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')) return 'x'
  if (pathname.endsWith('.pdf')) return 'pdf'
  return 'article'
}

function titleFromInput(input: string, type: KnowledgeSourceType) {
  if (type === 'paste') {
    const firstLine = input.split(/\r?\n/).map(line => line.trim()).find(Boolean) || 'Pasted source'
    return firstLine.slice(0, 90)
  }
  try {
    const url = new URL(input.trim())
    const host = url.hostname.replace(/^www\./, '')
    const slug = url.pathname.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ')
    return slug ? `${SOURCE_TYPE_LABELS[type]}: ${slug.slice(0, 80)}` : `${SOURCE_TYPE_LABELS[type]}: ${host}`
  } catch {
    return SOURCE_TYPE_LABELS[type]
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchText(url: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
        'user-agent': 'MissionControlKnowledgeIntake/0.2 (+local operator-reviewed extraction)',
        ...(init?.headers || {}),
      },
    })
    const text = await response.text()
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      text,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function extractJsonObjectAfter(html: string, marker: string) {
  const markerIndex = html.indexOf(marker)
  if (markerIndex < 0) return null
  const start = html.indexOf('{', markerIndex)
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < html.length; index += 1) {
    const char = html[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return html.slice(start, index + 1)
    }
  }
  return null
}

function extractYouTubeVideoId(input: string) {
  const url = new URL(input)
  if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || null
  if (url.searchParams.get('v')) return url.searchParams.get('v')
  const parts = url.pathname.split('/').filter(Boolean)
  const embedIndex = parts.findIndex(part => part === 'embed' || part === 'shorts')
  return embedIndex >= 0 ? parts[embedIndex + 1] || null : null
}

function parseYouTubeCaptionTrackUrl(html: string) {
  const playerJson = extractJsonObjectAfter(html, 'ytInitialPlayerResponse')
  if (!playerJson) return null
  try {
    const player = JSON.parse(playerJson)
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    if (!Array.isArray(tracks) || tracks.length === 0) return null
    const english = tracks.find((track: any) => String(track?.languageCode || '').toLowerCase().startsWith('en'))
    const selected = english || tracks[0]
    return typeof selected?.baseUrl === 'string' ? selected.baseUrl : null
  } catch {
    return null
  }
}

function parseTranscriptXml(xml: string) {
  const lines = [...xml.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)]
    .map(match => stripTags(match[1]))
    .filter(Boolean)
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

async function extractYouTubeTranscript(url: string): Promise<ExternalExtractionResult> {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) {
    return {
      status: 'manual_paste_needed',
      extractedText: 'transcript_unavailable: Could not detect a YouTube video id. Paste the transcript manually.',
      note: 'YouTube URL captured, but no video id could be detected.',
      error: 'transcript_unavailable: video id not detected',
    }
  }

  try {
    const watch = await fetchText(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`)
    if (!watch.ok) {
      return {
        status: 'manual_paste_needed',
        extractedText: `transcript_unavailable: YouTube page returned HTTP ${watch.status}. Paste the transcript manually.`,
        note: 'YouTube URL captured, but the watch page was not reachable.',
        error: `transcript_unavailable: watch page HTTP ${watch.status}`,
      }
    }

    const trackUrl = parseYouTubeCaptionTrackUrl(watch.text)
    if (!trackUrl) {
      return {
        status: 'manual_paste_needed',
        extractedText: 'transcript_unavailable: No caption track was found in the YouTube page. Paste the transcript manually.',
        note: 'YouTube URL captured, but captions/transcript were unavailable.',
        error: 'transcript_unavailable: captions not found',
      }
    }

    const transcriptResponse = await fetchText(trackUrl, { headers: { accept: 'text/xml,text/plain,*/*' } })
    if (!transcriptResponse.ok) {
      return {
        status: 'manual_paste_needed',
        extractedText: `transcript_unavailable: Caption track returned HTTP ${transcriptResponse.status}. Paste the transcript manually.`,
        note: 'YouTube URL captured, but the caption track was not reachable.',
        error: `transcript_unavailable: caption HTTP ${transcriptResponse.status}`,
      }
    }

    const transcript = parseTranscriptXml(transcriptResponse.text).slice(0, MAX_EXTRACTED_CHARS)
    if (transcript.length < 80) {
      return {
        status: 'manual_paste_needed',
        extractedText: 'transcript_unavailable: Caption track was empty or too short to summarize. Paste the transcript manually.',
        note: 'YouTube URL captured, but the transcript text was empty.',
        error: 'transcript_unavailable: empty caption track',
      }
    }

    return {
      status: 'ready_for_review',
      extractedText: transcript,
      note: 'YouTube transcript extracted locally and is ready for review.',
      error: null,
      title: `YouTube Transcript: ${videoId}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown fetch error'
    return {
      status: 'manual_paste_needed',
      extractedText: `transcript_unavailable: ${message}. Paste the transcript manually.`,
      note: 'YouTube URL captured, but transcript extraction failed.',
      error: `transcript_unavailable: ${message}`,
    }
  }
}

function extractMeta(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const propertyPattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')
  const contentFirstPattern = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
  return decodeHtml(propertyPattern.exec(html)?.[1] || contentFirstPattern.exec(html)?.[1] || '').trim()
}

function extractArticleTitle(html: string, fallbackUrl: string) {
  const title = extractMeta(html, 'og:title') || /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  if (title) return stripTags(title).slice(0, 120)
  return titleFromInput(fallbackUrl, 'article')
}

function extractArticleAuthor(html: string) {
  return extractMeta(html, 'author') || extractMeta(html, 'article:author') || null
}

function extractArticleText(html: string) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ')
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(withoutNoise)?.[1] || withoutNoise
  const chunks = [...body.matchAll(/<(h[1-3]|p|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(match => stripTags(match[2]))
    .filter(text => text.length > 24)

  const text = (chunks.length ? chunks.join('\n\n') : stripTags(body))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.slice(0, MAX_EXTRACTED_CHARS)
}

async function extractArticle(url: string): Promise<ExternalExtractionResult> {
  try {
    const response = await fetchText(url)
    if (!response.ok) {
      return {
        status: 'error',
        extractedText: `extraction_failed: Article URL returned HTTP ${response.status}.`,
        note: 'Article URL captured, but the page was not reachable.',
        error: `extraction_failed: HTTP ${response.status}`,
      }
    }
    if (response.contentType && !/(html|xml|text\/plain)/i.test(response.contentType)) {
      return {
        status: 'error',
        extractedText: `extraction_failed: Unsupported content type ${response.contentType}.`,
        note: 'Article URL captured, but the response was not a readable article page.',
        error: `extraction_failed: unsupported content type ${response.contentType}`,
      }
    }

    const text = extractArticleText(response.text)
    if (text.length < 120) {
      return {
        status: 'error',
        extractedText: 'extraction_failed: Page did not contain enough readable public text.',
        note: 'Article URL captured, but readable text extraction failed.',
        error: 'extraction_failed: insufficient readable text',
      }
    }

    return {
      status: 'ready_for_review',
      extractedText: text,
      note: 'Public article text extracted locally and is ready for review.',
      error: null,
      title: extractArticleTitle(response.text, url),
      author: extractArticleAuthor(response.text),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown fetch error'
    return {
      status: 'error',
      extractedText: `extraction_failed: ${message}.`,
      note: 'Article URL captured, but extraction failed.',
      error: `extraction_failed: ${message}`,
    }
  }
}

function sentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 20)
}

function keywords(text: string) {
  const counts = new Map<string, number>()
  for (const word of text.toLowerCase().match(/[a-z][a-z0-9+-]{2,}/g) || []) {
    if (STOPWORDS.has(word)) continue
    counts.set(word, (counts.get(word) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word)
}

function extractTools(text: string) {
  const known = [
    'Graphify', 'gBrain', 'Obsidian', 'Retell', 'Supabase', 'SendGrid', 'Telegram', 'Mission Control',
    'OpenClaw', 'Playwright', 'Next.js', 'Vercel', 'Railway', 'Canva', 'Remotion', 'YouTube', 'X',
    'SQLite', 'Postgres', 'Wiki', 'Brain', 'Memory',
  ]
  const found = known.filter(tool => new RegExp(`\\b${tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))
  return [...new Set(found)]
}

function extractSteps(text: string, sourceType: KnowledgeSourceType) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean)
  const actionLines = lines.filter(line => /^(build|create|add|wire|connect|test|verify|ship|install|run|make|use|capture|extract|summarize|write|document)\b/i.test(line))
  const fallback = sourceType === 'paste'
    ? ['Capture the source text as raw evidence.', 'Review the extracted ideas before writing durable knowledge.', 'Promote only approved tasks or wiki drafts with source citations.']
    : ['Capture the source URL and context note.', 'Paste transcript/article text or add credentials before full extraction.', 'Review generated notes before any Wiki, Brain, Memory, or task write.']
  return (actionLines.length ? actionLines : fallback).slice(0, 6)
}

function extractClaims(text: string, sourceType: KnowledgeSourceType) {
  const claimSentences = sentences(text).filter(sentence =>
    /\b(always|never|best|only|must|proven|guarantee|guaranteed|#1|percent|%|\d+x|\d+ hours?|\d+ days?)\b/i.test(sentence)
  )
  if (claimSentences.length) return claimSentences.slice(0, 6)
  if (sourceType === 'paste') return ['Verify any operational claims before adding them to durable memory or project plans.']
  return ['Full extraction is pending; verify source content before promoting this URL into durable memory.']
}

function recommendedDestinations(input: CreateKnowledgeSourceInput, type: KnowledgeSourceType, text: string) {
  const destinations = new Set<string>()
  const scope = input.project_scope || ''
  if (/material solutions|david/i.test(scope + text)) destinations.add('Material Solutions / David')
  if (/mission control|blackwire|agent|koda|herm/i.test(scope + text)) destinations.add('Mission Control')
  if (/marketing|campaign|email|seo|aeo/i.test(text)) destinations.add('Marketing')
  if (/task|build|bug|fix|implement|ship/i.test(text)) destinations.add('Task Board')
  if (type === 'paste' || type === 'article' || type === 'youtube' || type === 'x') destinations.add('General Vortex Wiki')
  destinations.add('Research Command')
  return [...destinations].slice(0, 6)
}

async function summarize(input: CreateKnowledgeSourceInput, type: KnowledgeSourceType): Promise<SummarizeResult> {
  const content = input.content.trim()
  const sourceUrl = isUrl(content) ? content : null

  if (type !== 'paste') {
    const external = type === 'youtube'
      ? await extractYouTubeTranscript(content)
      : type === 'article'
        ? await extractArticle(content)
        : null

    if (external && external.status === 'ready_for_review') {
      const extracted = external.extractedText
      const sentenceList = sentences(extracted)
      const topKeywords = keywords(extracted)
      return {
        status: external.status,
        text: external.note,
        extractedText: extracted,
        error: null,
        title: external.title,
        author: external.author,
        extraction: {
          summary: sentenceList.slice(0, 2).join(' ') || extracted.slice(0, 260),
          key_ideas: sentenceList.slice(0, 5).length ? sentenceList.slice(0, 5) : topKeywords.map(word => `Important theme: ${word}`),
          tools_mentioned: extractTools(extracted),
          implementation_steps: extractSteps(extracted, type),
          claims_to_verify: extractClaims(extracted, type),
          recommended_destinations: recommendedDestinations(input, type, extracted),
        },
      }
    }

    const note = external?.note || (type === 'x'
      ? 'X/Twitter URL captured. Full extraction needs official X credentials or pasted thread text.'
      : type === 'pdf'
        ? 'PDF/file URL captured. File OCR/MarkItDown extraction is scaffolded for the next slice.'
        : 'URL captured. Extraction is unavailable; paste source text if immediate summarization is needed.')
    const status: KnowledgeSourceStatus = external?.status || (type === 'x' ? 'credentials_needed' : 'captured')
    const error = external?.error || (type === 'x' ? 'Credentials Needed: official X API credentials are not configured; paste text manually for extraction.' : null)
    return {
      status,
      text: note,
      extractedText: external?.extractedText || note,
      error,
      title: external?.title,
      author: external?.author,
      extraction: {
        summary: note,
        key_ideas: [
          `${SOURCE_TYPE_LABELS[type]} source captured with citation preserved.`,
          error ? 'Full extraction did not complete; no summary was invented.' : 'Full extraction is intentionally not faked when adapters cannot read the source.',
          'Manual paste path can produce review-ready summaries immediately.',
        ],
        tools_mentioned: extractTools(content),
        implementation_steps: extractSteps(content, type),
        claims_to_verify: extractClaims(content, type),
        recommended_destinations: recommendedDestinations(input, type, content),
      },
    }
  }

  const sentenceList = sentences(content)
  const topKeywords = keywords(content)
  const keyIdeas = sentenceList.slice(0, 5)
  return {
    status: 'ready_for_review',
    text: content,
    extractedText: content,
    error: null,
    extraction: {
      summary: sentenceList.slice(0, 2).join(' ') || content.slice(0, 260),
      key_ideas: keyIdeas.length ? keyIdeas : topKeywords.map(word => `Important theme: ${word}`),
      tools_mentioned: extractTools(content),
      implementation_steps: extractSteps(content, type),
      claims_to_verify: extractClaims(content, type),
      recommended_destinations: recommendedDestinations(input, type, content),
    },
  }
}

export async function createKnowledgeSource(input: CreateKnowledgeSourceInput): Promise<KnowledgeIntakeSnapshot> {
  const content = input.content.trim()
  if (!content) throw new Error('Knowledge intake content is required')

  ensureDirExists(rawDir())
  ensureDirExists(extractedDir())

  const sourceType = detectKnowledgeSourceType(content)
  const id = crypto.randomUUID()
  const now = Date.now()
  const initialTitle = titleFromInput(content, sourceType)
  const extractionResult = await summarize(input, sourceType)
  const title = extractionResult.title || initialTitle
  const baseName = `${now}-${safeSlug(title)}`
  const rawPath = path.join(rawDir(), `${baseName}.txt`)
  const extractedPath = path.join(extractedDir(), `${baseName}.md`)

  fs.writeFileSync(rawPath, content)
  fs.writeFileSync(extractedPath, extractionResult.extractedText)

  const source: KnowledgeSource = {
    id,
    workspace_id: input.workspace_id || 1,
    source_type: sourceType,
    source_url: isUrl(content) ? content : null,
    title,
    author: extractionResult.author || null,
    captured_at: now,
    raw_path: rawPath,
    extracted_text_path: extractedPath,
    status: extractionResult.status,
    error: extractionResult.error,
    tags: input.tags || [],
    project_scope: input.project_scope || 'Mission Control',
    context_note: input.context_note?.trim() || null,
  }

  const extraction: KnowledgeExtraction = {
    source_id: id,
    ...extractionResult.extraction,
    citations: [
      source.source_url
        ? { label: title, url: source.source_url, path: rawPath }
        : { label: 'Raw pasted source', path: rawPath },
    ],
  }

  const store = readStore()
  store.sources = [source, ...store.sources].slice(0, 100)
  store.extractions = [extraction, ...store.extractions.filter(item => item.source_id !== id)].slice(0, 100)
  writeStore(store)

  return buildSnapshot(source, extraction, store)
}

function buildSnapshot(source: KnowledgeSource, extraction: KnowledgeExtraction, store = readStore()): KnowledgeIntakeSnapshot {
  return {
    generatedAt: Date.now(),
    guardrails: knowledgeIntakeGuardrails(),
    detection: {
      source_type: source.source_type,
      label: SOURCE_TYPE_LABELS[source.source_type],
      extraction_status: source.status,
      extraction_note: source.status === 'ready_for_review'
        ? 'Review-ready extraction produced locally.'
        : source.status === 'manual_paste_needed'
          ? 'Source captured, but full extraction needs a pasted transcript or source text.'
          : source.status === 'error'
            ? 'Extraction failed; source and error receipt were preserved without invented content.'
        : source.status === 'credentials_needed'
          ? 'Credentials needed before full extraction; manual paste remains available.'
          : 'Raw source captured; adapter extraction remains honest.',
    },
    source,
    extraction,
    recent_sources: listKnowledgeSources(10, store),
    gates: knowledgeIntakeGates(),
  }
}

export function listKnowledgeSources(limit = 20, store = readStore()) {
  return store.sources.slice(0, limit).map(source => ({
    ...source,
    extraction: store.extractions.find(extraction => extraction.source_id === source.id),
  }))
}

export function getKnowledgeIntakeHomeSnapshot() {
  return {
    generatedAt: Date.now(),
    guardrails: knowledgeIntakeGuardrails(),
    recent_sources: listKnowledgeSources(12),
    gates: knowledgeIntakeGates(),
    supported_types: Object.entries(SOURCE_TYPE_LABELS).map(([id, label]) => ({ id, label })),
  }
}

export function requestKnowledgeLearningAction(sourceId: string, destination: string): KnowledgeLearningReceipt {
  const store = readStore()
  const source = store.sources.find(item => item.id === sourceId)
  if (!source) throw new Error('Knowledge source not found')

  const receipt: KnowledgeLearningReceipt = {
    id: crypto.randomUUID(),
    source_id: sourceId,
    destination,
    status: 'approval_required',
    files_written: [],
    tasks_created: [],
    approval_id: null,
    created_at: Date.now(),
    reason: 'Approval Required: durable Wiki, Brain, Memory, Graphify/gBrain/Obsidian, or task writes are blocked until an operator approves the exact destination and blast radius.',
  }
  store.learning_receipts = [receipt, ...store.learning_receipts].slice(0, 100)
  writeStore(store)
  return receipt
}

export function knowledgeIntakeGuardrails() {
  return [
    'Capture Raw can run locally; external posts, sends, account mutations, spend, and customer-facing actions are blocked.',
    'Write to Wiki, Brain, Memory, knowledge graph, workspace memory, or Task Board requires explicit approval and a receipt.',
    'Social URL extraction stays Credentials Needed unless official read credentials exist or the operator pastes source text.',
    'YouTube transcripts and article pages extract only when public readable text is available; unavailable sources must say transcript_unavailable or extraction_failed.',
    'Customer-specific memory must stay isolated from general workspace and unrelated project memory.',
    'If extraction is pending, preserve the source URL and raw path instead of inventing a summary.',
  ]
}

export function knowledgeIntakeGates() {
  return [
    { action: 'Capture Raw', status: 'available' as const, detail: 'Stores the source text or URL locally with a raw evidence path.' },
    { action: 'Extract / Summarize', status: 'available' as const, detail: 'Pasted text extracts locally; public article pages and available YouTube transcripts extract into review cards; blocked sources stay honest.' },
    { action: 'Write to Wiki / Brain / Memory', status: 'approval_required' as const, detail: 'Requires approval before durable memory writes or Graphify/gBrain/Obsidian ingestion.' },
    { action: 'Create Task', status: 'approval_required' as const, detail: 'Requires approval before adding work to tracker boards.' },
    { action: 'Post / Send / Act externally', status: 'blocked' as const, detail: 'No social post, customer send, trade, spend, or account mutation from this surface.' },
  ]
}
