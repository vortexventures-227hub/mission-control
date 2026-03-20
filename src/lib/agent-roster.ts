/**
 * Agent Roster - Maps agent IDs to display names and roles
 * This is the source of truth for agent identities in Mission Control
 */

export interface AgentProfile {
  displayName: string
  role: string
  emoji?: string
  color?: string
}

// Agent roster mapping
export const AGENT_ROSTER: Record<string, AgentProfile> = {
  main: {
    displayName: 'Axis',
    role: 'Chief Strategic Orchestrator (CSO)',
    emoji: '🪓',
    color: '#38bdf8', // sky-400
  },
  mrblanc: {
    displayName: 'Mr. Blanc',
    role: 'Head of Research',
    emoji: '🔍',
    color: '#a78bfa', // violet-400
  },
  knox: {
    displayName: 'Knox',
    role: 'Head of Security',
    emoji: '🛡️',
    color: '#f87171', // red-400
  },
  cortex: {
    displayName: 'Cortex',
    role: 'Head of Memory',
    emoji: '🧠',
    color: '#fbbf24', // amber-400
  },
  cipher: {
    displayName: 'Cipher',
    role: 'Head of Engineering',
    emoji: '⚙️',
    color: '#34d399', // emerald-400
  },
  scribe: {
    displayName: 'Scribe',
    role: 'Content Processor',
    emoji: '📝',
    color: '#60a5fa', // blue-400
  },
}

/**
 * Get agent profile by ID (name field from database)
 * Falls back to a default profile if agent not in roster
 */
export function getAgentProfile(agentId: string): AgentProfile {
  const normalized = agentId.toLowerCase().trim()
  
  if (AGENT_ROSTER[normalized]) {
    return AGENT_ROSTER[normalized]
  }
  
  // Fallback for unknown agents
  return {
    displayName: agentId.charAt(0).toUpperCase() + agentId.slice(1),
    role: 'Agent',
    emoji: '🤖',
    color: '#94a3b8', // slate-400
  }
}

/**
 * Check if an agent ID is in the known roster
 */
export function isKnownAgent(agentId: string): boolean {
  return agentId.toLowerCase().trim() in AGENT_ROSTER
}
