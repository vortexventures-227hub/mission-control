/**
 * Agent Roster - Maps agent IDs to display names and roles
 * This is the source of truth for agent identities in Mission Control
 * Updated: 2026-03-24
 */

export type TeamType = 'command' | 'valphaops' | 'davidscrew' | 'appfactory' | 'research' | 'tradingops' | 'other'

export interface AgentProfile {
  displayName: string
  role: string
  description: string
  emoji?: string
  color?: string
  team: TeamType
  avatar?: string // Optional avatar image URL
}

export interface TeamInfo {
  id: TeamType
  name: string
  description: string
  color: string
  icon: string
}

export const TEAMS: Record<TeamType, TeamInfo> = {
  command: {
    id: 'command',
    name: 'Command',
    description: 'Strategic orchestration and coordination',
    color: '#38bdf8',
    icon: '🎯',
  },
  valphaops: {
    id: 'valphaops',
    name: 'VAlphaOps',
    description: 'Core operations team',
    color: '#34d399',
    icon: '⚡',
  },
  davidscrew: {
    id: 'davidscrew',
    name: "David's Crew",
    description: 'App development and operations',
    color: '#f59e0b',
    icon: '🔨',
  },
  appfactory: {
    id: 'appfactory',
    name: 'App Factory',
    description: 'App building and deployment',
    color: '#8b5cf6',
    icon: '🏭',
  },
  research: {
    id: 'research',
    name: 'Research Division',
    description: 'Deep research and intelligence',
    color: '#a78bfa',
    icon: '🔬',
  },
  tradingops: {
    id: 'tradingops',
    name: 'Trading Ops (Gekko)',
    description: 'Automated trading and market operations',
    color: '#22c55e',
    icon: '📈',
  },
  other: {
    id: 'other',
    name: 'Other',
    description: 'Other agents',
    color: '#94a3b8',
    icon: '🤖',
  },
}

// Agent roster mapping - All team members
export const AGENT_ROSTER: Record<string, AgentProfile> = {
  // ═══════════════════════════════════════════════════════════════════
  // COMMAND - The orchestrator
  // ═══════════════════════════════════════════════════════════════════
  main: {
    displayName: 'Axis',
    role: 'Chief Strategic Orchestrator (CSO)',
    description: 'The architect and brain of the agentic team. Strategizes, coordinates, and orchestrates all operations.',
    emoji: '🪓',
    color: '#38bdf8', // sky-400
    team: 'command',
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // VALPHAOPS TEAM - Core operations
  // ═══════════════════════════════════════════════════════════════════
  cipher: {
    displayName: 'Cipher',
    role: 'Head of Engineering',
    description: 'Code architecture, implementation, debugging, PR reviews, and technical problem-solving.',
    emoji: '⚙️',
    color: '#34d399', // emerald-400
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
  michelangelo: {
    displayName: 'Michelangelo',
    role: 'Head of Visual Arts & Design',
    description: 'Image generation, avatars, UI/UX design, branding, and creative direction.',
    emoji: '🎨',
    color: '#f472b6', // pink-400
    team: 'valphaops',
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // DAVID'S CREW - App development team
  // ═══════════════════════════════════════════════════════════════════
  david: {
    displayName: 'David',
    role: 'Crew Lead',
    description: 'Team lead for app development operations.',
    emoji: '👔',
    color: '#f59e0b', // amber-500
    team: 'davidscrew',
  },
  gary: {
    displayName: 'Gary',
    role: 'Senior Developer',
    description: 'Senior app developer and code reviewer.',
    emoji: '💻',
    color: '#10b981', // emerald-500
    team: 'davidscrew',
  },
  eddie: {
    displayName: 'Eddie',
    role: 'Backend Engineer',
    description: 'Backend systems and API development.',
    emoji: '🔧',
    color: '#6366f1', // indigo-500
    team: 'davidscrew',
  },
  frank: {
    displayName: 'Frank',
    role: 'Frontend Engineer',
    description: 'UI/UX implementation and frontend development.',
    emoji: '🖥️',
    color: '#06b6d4', // cyan-500
    team: 'davidscrew',
  },
  bob: {
    displayName: 'Bob',
    role: 'DevOps Engineer',
    description: 'CI/CD, deployment, and infrastructure.',
    emoji: '🚀',
    color: '#8b5cf6', // violet-500
    team: 'davidscrew',
  },
  lou: {
    displayName: 'Lou',
    role: 'QA Engineer',
    description: 'Quality assurance and testing.',
    emoji: '🔍',
    color: '#ec4899', // pink-500
    team: 'davidscrew',
  },
  sal: {
    displayName: 'Sal',
    role: 'Mobile Developer',
    description: 'iOS and Android app development.',
    emoji: '📱',
    color: '#14b8a6', // teal-500
    team: 'davidscrew',
  },
  carl: {
    displayName: 'Carl',
    role: 'Database Engineer',
    description: 'Database design and optimization.',
    emoji: '🗄️',
    color: '#f97316', // orange-500
    team: 'davidscrew',
  },
  hank: {
    displayName: 'Hank',
    role: 'Integration Specialist',
    description: 'Third-party integrations and APIs.',
    emoji: '🔌',
    color: '#84cc16', // lime-500
    team: 'davidscrew',
  },
  // ═══════════════════════════════════════════════════════════════════
  // RESEARCH DIVISION - Deep research and intelligence
  // ═══════════════════════════════════════════════════════════════════
  mrblanc: {
    displayName: 'Mr. Blanc',
    role: 'Head of Research',
    description: 'Deep-dive research, web intelligence, social monitoring, market analysis, and competitive intel.',
    emoji: '🔍',
    color: '#a78bfa', // violet-400
    team: 'research',
  },
  mrgecko: {
    displayName: 'Mr. Gecko',
    role: 'Head of Financial Research',
    description: 'Polymarket intel, trading strategies, market analysis, economic research, and financial intelligence.',
    emoji: '🦎',
    color: '#4ade80', // green-400
    team: 'research',
  },
  mrpink: {
    displayName: 'Mr. Pink',
    role: 'Head of Social & Competitive Intel',
    description: 'X monitoring, influencer tracking, competitor surveillance, brand sentiment, and viral content analysis.',
    emoji: '🩷',
    color: '#ec4899', // pink-500
    team: 'research',
  },
  mrorange: {
    displayName: 'Mr. Orange',
    role: 'Field Intelligence Analyst',
    description: 'On-ground data gathering, source verification, and real-time intel reporting.',
    emoji: '🍊',
    color: '#f97316', // orange-500
    team: 'research',
  },
  mrsteel: {
    displayName: 'Mr. Steel',
    role: 'Technical Research Analyst',
    description: 'System architecture research, technical documentation, and infrastructure intel.',
    emoji: '🏗️',
    color: '#64748b', // slate-500
    team: 'research',
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // APP FACTORY - App building pipeline
  // ═══════════════════════════════════════════════════════════════════
  factory: {
    displayName: 'Factory',
    role: 'Build Coordinator',
    description: 'Coordinates app building pipeline and deployments.',
    emoji: '🏭',
    color: '#8b5cf6', // violet-500
    team: 'appfactory',
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // TRADING OPS (GEKKO) - Automated trading operations
  // ═══════════════════════════════════════════════════════════════════
  herald: {
    displayName: 'Herald',
    role: 'Market Announcer',
    description: 'Real-time market news, price alerts, and trading signal announcements.',
    emoji: '📢',
    color: '#3b82f6', // blue-500
    team: 'tradingops',
  },
  atlas: {
    displayName: 'Atlas',
    role: 'Portfolio Manager',
    description: 'Portfolio tracking, position sizing, and risk management.',
    emoji: '🗺️',
    color: '#22c55e', // green-500
    team: 'tradingops',
  },
  spread: {
    displayName: 'Spread',
    role: 'Arbitrage Specialist',
    description: 'Cross-exchange arbitrage, spread trading, and market making.',
    emoji: '📊',
    color: '#eab308', // yellow-500
    team: 'tradingops',
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // OTHER AGENTS
  // ═══════════════════════════════════════════════════════════════════
  scout: {
    displayName: 'Scout',
    role: 'Reconnaissance Agent',
    description: 'Exploratory tasks, preliminary research, and information gathering.',
    emoji: '🔭',
    color: '#2dd4bf', // teal-400
    team: 'other',
  },
  ledger: {
    displayName: 'Ledger',
    role: 'Financial Agent',
    description: 'Expense tracking, financial analysis, and budget management.',
    emoji: '💰',
    color: '#4ade80', // green-400
    team: 'other',
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
  'mr gecko': 'mrgecko',
  'mr. gecko': 'mrgecko',
  'gecko': 'mrgecko',
  'mr pink': 'mrpink',
  'mr. pink': 'mrpink',
  'pink': 'mrpink',
  'mr steel': 'mrsteel',
  'mr. steel': 'mrsteel',
  'steel': 'mrsteel',
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
export function getAgentsByTeam(team: TeamType): string[] {
  return Object.entries(AGENT_ROSTER)
    .filter(([_, profile]) => profile.team === team)
    .map(([id]) => id)
}

/**
 * Get all teams with their agents
 */
export function getAllTeams(): Array<{ team: TeamInfo; agents: AgentProfile[] }> {
  const teams: Array<{ team: TeamInfo; agents: AgentProfile[] }> = []
  
  for (const teamType of Object.keys(TEAMS) as TeamType[]) {
    const teamAgents = Object.entries(AGENT_ROSTER)
      .filter(([_, profile]) => profile.team === teamType)
      .map(([_, profile]) => profile)
    
    if (teamAgents.length > 0) {
      teams.push({
        team: TEAMS[teamType],
        agents: teamAgents,
      })
    }
  }
  
  return teams
}

/**
 * Get the full command structure with all teams
 */
export function getCommandStructure(): Record<TeamType, string[]> {
  const structure: Record<TeamType, string[]> = {} as Record<TeamType, string[]>
  
  for (const teamType of Object.keys(TEAMS) as TeamType[]) {
    structure[teamType] = getAgentsByTeam(teamType)
  }
  
  return structure
}

/**
 * Get team info by type
 */
export function getTeamInfo(team: TeamType): TeamInfo {
  return TEAMS[team]
}
