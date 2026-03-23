/**
 * Agent Roster - Maps agent IDs to display names and roles
 * This is the source of truth for agent identities in Mission Control
 * Updated: 2026-03-23
 */

export interface AgentProfile {
  displayName: string
  role: string
  description: string
  emoji?: string
  color?: string
  team: 'command' | 'valphaops' | 'other'
}

// Agent roster mapping - All VAlphaOps team members
export const AGENT_ROSTER: Record<string, AgentProfile> = {
  // Command - The orchestrator
  main: {
    displayName: 'Axis',
    role: 'Chief Strategic Orchestrator (CSO)',
    description: 'The architect and brain of the agentic team. Strategizes, coordinates, and orchestrates all operations.',
    emoji: '🪓',
    color: '#38bdf8', // sky-400
    team: 'command',
  },
  
  // VAlphaOps Team
  mrblanc: {
    displayName: 'Mr. Blanc',
    role: 'Head of Research',
    description: 'Deep-dive research, web intelligence, social monitoring, market analysis, and competitive intel.',
    emoji: '🔍',
    color: '#a78bfa', // violet-400
    team: 'valphaops',
  },
  cipher: {
    displayName: 'Cipher',
    role: 'Head of Engineering',
    description: 'Code architecture, implementation, debugging, PR reviews, and technical problem-solving.',
    emoji: '⚙️',
    color: '#34d399', // emerald-400
    team: 'valphaops',
  },
  michelangelo: {
    displayName: 'Michelangelo',
    role: 'Head of Visual Arts & Design',
    description: 'Image generation, avatars, UI/UX design, branding, and creative direction.',
    emoji: '🎨',
    color: '#f472b6', // pink-400
    team: 'valphaops',
  },
  knox: {
    displayName: 'Knox',
    role: 'Head of Security',
    description: 'Security audits, threat monitoring, credential management, and policy enforcement.',
    emoji: '🛡️',
    color: '#f87171', // red-400
    team: 'valphaops',
  },
  cortex: {
    displayName: 'Cortex',
    role: 'Head of Memory',
    description: 'Memory maintenance, context organization, knowledge base management, and reminders.',
    emoji: '🧠',
    color: '#fbbf24', // amber-400
    team: 'valphaops',
  },
  scribe: {
    displayName: 'Scribe',
    role: 'Documentation Specialist',
    description: 'Notes, summaries, documentation, knowledge base updates, and briefings.',
    emoji: '📝',
    color: '#60a5fa', // blue-400
    team: 'valphaops',
  },
  scout: {
    displayName: 'Scout',
    role: 'Reconnaissance Agent',
    description: 'Exploratory tasks, preliminary research, and information gathering.',
    emoji: '🔭',
    color: '#2dd4bf', // teal-400
    team: 'valphaops',
  },
  ledger: {
    displayName: 'Ledger',
    role: 'Financial Agent',
    description: 'Expense tracking, financial analysis, and budget management.',
    emoji: '💰',
    color: '#4ade80', // green-400
    team: 'valphaops',
  },
}

// Aliases for common variations
const AGENT_ALIASES: Record<string, string> = {
  'main agent': 'main',
  'axis': 'main',
  'coordinator': 'main',
  'mr blanc': 'mrblanc',
  'mr. blanc': 'mrblanc',
  'blanc': 'mrblanc',
}

/**
 * Get agent profile by ID (name field from database)
 * Falls back to a default profile if agent not in roster
 */
export function getAgentProfile(agentId: string): AgentProfile {
  const normalized = agentId.toLowerCase().trim().replace(/[\s.-]+/g, '')
  
  // Direct match
  if (AGENT_ROSTER[normalized]) {
    return AGENT_ROSTER[normalized]
  }
  
  // Check aliases
  const aliasNormalized = agentId.toLowerCase().trim()
  if (AGENT_ALIASES[aliasNormalized]) {
    return AGENT_ROSTER[AGENT_ALIASES[aliasNormalized]]
  }
  
  // Fallback for unknown agents
  return {
    displayName: agentId.charAt(0).toUpperCase() + agentId.slice(1),
    role: 'Agent',
    description: '',
    emoji: '🤖',
    color: '#94a3b8', // slate-400
    team: 'other',
  }
}

/**
 * Check if an agent ID is in the known roster
 */
export function isKnownAgent(agentId: string): boolean {
  const normalized = agentId.toLowerCase().trim().replace(/[\s.-]+/g, '')
  return normalized in AGENT_ROSTER || agentId.toLowerCase().trim() in AGENT_ALIASES
}

/**
 * Get all agents by team
 */
export function getAgentsByTeam(team: AgentProfile['team']): string[] {
  return Object.entries(AGENT_ROSTER)
    .filter(([_, profile]) => profile.team === team)
    .map(([id]) => id)
}

/**
 * Get the VAlphaOps command structure
 */
export function getCommandStructure(): { command: string[]; valphaops: string[] } {
  return {
    command: getAgentsByTeam('command'),
    valphaops: getAgentsByTeam('valphaops'),
  }
}
