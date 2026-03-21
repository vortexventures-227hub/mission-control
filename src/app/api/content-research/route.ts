import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { requireRole } from '@/lib/auth'
import { readLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const log = logger.child({ module: 'content-research' })

// Path to YouTubeDigest.md
const YOUTUBE_DIGEST_PATH = join(
  homedir(),
  'Desktop/VVAxeOps/AxeVault/40_KNOWLEDGE/ContentResearch/YouTubeDigest.md'
)

export interface VideoEntry {
  id: string
  title: string
  url: string
  channel: string
  views?: string
  date?: string
  relevanceTag?: string
  insights: string[]
  actionableItems: string[]
  toolsMentioned: string[]
  rawContent: string
}

export interface ContentResearchResponse {
  videos: VideoEntry[]
  aggregated: {
    actionableItems: string[]
    toolsMentioned: string[]
  }
  lastUpdated: number
  error?: string
}

/**
 * Parse YouTubeDigest.md into structured video entries
 */
function parseYouTubeDigest(content: string): VideoEntry[] {
  const videos: VideoEntry[] = []
  
  // Split by entry separator (--- or ### heading)
  const sections = content.split(/\n---\n|\n(?=### )/)
  
  for (const section of sections) {
    if (!section.trim()) continue
    
    // Skip header/format sections
    if (section.includes('# YouTube AI Content Digest') || section.includes('## Format') || section.includes('## Entries')) {
      continue
    }
    
    // Parse title
    const titleMatch = section.match(/^###?\s+(.+?)$/m)
    if (!titleMatch) continue
    
    const title = titleMatch[1].trim()
    
    // Parse URL
    const urlMatch = section.match(/\*\*URL:\*\*\s*<?([^\s>]+)>?/i) || 
                     section.match(/URL:\s*<?([^\s>]+)>?/i) ||
                     section.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s)]+)/i)
    const url = urlMatch ? urlMatch[1].trim() : ''
    
    // Parse Channel
    const channelMatch = section.match(/\*\*Channel:\*\*\s*(.+?)(?:\||$|\n)/i) ||
                         section.match(/Channel:\s*(.+?)(?:\||$|\n)/i)
    const channel = channelMatch ? channelMatch[1].trim() : 'Unknown'
    
    // Parse Views
    const viewsMatch = section.match(/\*\*Views:\*\*\s*([^\||\n]+)/i) ||
                       section.match(/Views:\s*([^\||\n]+)/i)
    const views = viewsMatch ? viewsMatch[1].trim() : undefined
    
    // Parse Date
    const dateMatch = section.match(/\*\*Date:\*\*\s*([^\||\n]+)/i) ||
                      section.match(/Date:\s*([^\||\n]+)/i)
    const date = dateMatch ? dateMatch[1].trim() : undefined
    
    // Parse Relevance Tag
    const relevanceMatch = section.match(/\*\*Relevance:\*\*\s*(\w+)/i) ||
                           section.match(/Relevance:\s*(\w+)/i)
    const relevanceTag = relevanceMatch ? relevanceMatch[1].trim().toLowerCase() : undefined
    
    // Parse Key Insights
    const insightsSection = section.match(/\*\*Key Insights:\*\*\s*([\s\S]*?)(?=\*\*|$)/i)
    const insights: string[] = []
    if (insightsSection) {
      const lines = insightsSection[1].split('\n')
      for (const line of lines) {
        const bulletMatch = line.match(/^[-*]\s+(.+)$/)
        if (bulletMatch) {
          insights.push(bulletMatch[1].trim())
        }
      }
    }
    
    // Parse Actionable Items
    const actionSection = section.match(/\*\*Actionable Items:\*\*\s*([\s\S]*?)(?=\*\*|$)/i)
    const actionableItems: string[] = []
    if (actionSection) {
      const lines = actionSection[1].split('\n')
      for (const line of lines) {
        const bulletMatch = line.match(/^[-*]\s+(.+)$/)
        if (bulletMatch) {
          actionableItems.push(bulletMatch[1].trim())
        }
      }
    }
    
    // Parse Tools Mentioned
    const toolsSection = section.match(/\*\*Tools Mentioned:\*\*\s*([\s\S]*?)(?=\*\*|---|$)/i)
    const toolsMentioned: string[] = []
    if (toolsSection) {
      const lines = toolsSection[1].split('\n')
      for (const line of lines) {
        const bulletMatch = line.match(/^[-*]\s+(.+)$/)
        if (bulletMatch) {
          toolsMentioned.push(bulletMatch[1].trim())
        }
      }
    }
    
    // Only add if we have at least a title
    if (title && title !== 'Video title and URL') {
      videos.push({
        id: generateVideoId(url || title),
        title,
        url,
        channel,
        views,
        date,
        relevanceTag,
        insights,
        actionableItems,
        toolsMentioned,
        rawContent: section.trim()
      })
    }
  }
  
  return videos
}

function generateVideoId(input: string): string {
  const ytMatch = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return ytMatch[1]
  
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `vid-${Math.abs(hash).toString(36)}`
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = readLimiter(request)
  if (rateCheck) return rateCheck

  try {
    let content: string
    try {
      content = await readFile(YOUTUBE_DIGEST_PATH, 'utf-8')
    } catch (err) {
      const e = err as NodeJS.ErrnoException
      if (e.code === 'ENOENT') {
        return NextResponse.json({
          videos: [],
          aggregated: { actionableItems: [], toolsMentioned: [] },
          lastUpdated: Date.now(),
          error: 'YouTubeDigest.md not found. Scanning will begin at 3 AM daily.'
        } as ContentResearchResponse)
      }
      throw err
    }
    
    const videos = parseYouTubeDigest(content)
    
    const allActionableItems: string[] = []
    const allToolsMentioned: string[] = []
    const toolsSet = new Set<string>()
    
    for (const video of videos) {
      allActionableItems.push(...video.actionableItems)
      for (const tool of video.toolsMentioned) {
        if (!toolsSet.has(tool.toLowerCase())) {
          toolsSet.add(tool.toLowerCase())
          allToolsMentioned.push(tool)
        }
      }
    }
    
    const response: ContentResearchResponse = {
      videos,
      aggregated: {
        actionableItems: allActionableItems,
        toolsMentioned: allToolsMentioned
      },
      lastUpdated: Date.now()
    }
    
    return NextResponse.json(response)
    
  } catch (err) {
    log.error({ err }, 'Failed to read content research')
    return NextResponse.json(
      { error: 'Failed to load content research' },
      { status: 500 }
    )
  }
}
