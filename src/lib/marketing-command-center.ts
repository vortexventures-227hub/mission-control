export type MarketingStatus = 'live' | 'planned' | 'not_instrumented' | 'approval_required' | 'blocked'

export interface MarketingPrinciple {
  id: string
  title: string
  category: string
  status: MarketingStatus
  guidance: string
  ethicalBoundary: string
}

export interface MarketingPlaybook {
  id: string
  channel: string
  status: MarketingStatus
  goal: string
  guardrail: string
  nextAction: string
}

export interface MarketingTool {
  id: string
  name: string
  category: string
  status: 'installed' | 'staged' | 'researched' | 'approved' | 'not_adopted' | 'unsafe' | 'blocked'
  safetyNote: string
}

export interface MarketingTemplate {
  id: string
  title: string
  kind: string
  status: MarketingStatus
  useCase: string
}

export interface MarketingExperiment {
  id: string
  project: string
  hypothesis: string
  channel: string
  status: MarketingStatus
  successMetric: string
  evidence: string
  approvalRequired: boolean
}

export interface ProjectMarketingProfile {
  id: string
  project: string
  offer: string
  audience: string
  status: MarketingStatus
  analyticsStatus: 'Live' | 'Imported' | 'Manual' | 'Not Instrumented Yet' | 'Stale'
  approvalsRequired: string[]
  nextAction: string
}

export function getMarketingCommandCenterSnapshot() {
  const generatedAt = Date.now()

  const principles: MarketingPrinciple[] = [
    {
      id: 'micro-compliance',
      title: 'Micro-compliance / small-yes momentum',
      category: 'psychology',
      status: 'planned',
      guidance: 'Break onboarding and buying paths into low-friction yes/no choices that earn trust before asking for higher-commitment action.',
      ethicalBoundary: 'No dark patterns; each yes must be reversible and clearly described.',
    },
    {
      id: 'color-language-psychology',
      title: 'Color and language psychology',
      category: 'positioning',
      status: 'planned',
      guidance: 'Use color, contrast, and plain-language framing to signal trust, urgency, calm, proof, or premium value by project context.',
      ethicalBoundary: 'Do not disguise risk, pricing, consent, or campaign sponsorship.',
    },
    {
      id: 'trust-social-proof',
      title: 'Trust and social-proof mechanics',
      category: 'persuasion',
      status: 'planned',
      guidance: 'Attach claims to receipts, testimonials, proof photos, analytics, customer outcomes, or verified operator notes.',
      ethicalBoundary: 'No fabricated testimonials, fake scarcity, fake analytics, or inflated campaign results.',
    },
    {
      id: 'onboarding-momentum',
      title: 'Onboarding momentum loops',
      category: 'activation',
      status: 'planned',
      guidance: 'Give every new visitor/customer/operator a visible first win, next step, and progress indicator.',
      ethicalBoundary: 'Do not hide cancellation, opt-out, or manual-review boundaries.',
    },
  ]

  const playbooks: MarketingPlaybook[] = [
    { id: 'landing-pages', channel: 'Website / landing pages', status: 'planned', goal: 'Clarify offer, proof, CTA, risk reversal, and conversion event.', guardrail: 'Analytics missing must say Not Instrumented Yet.', nextAction: 'Create per-project offer/ICP blocks before writing copy.' },
    { id: 'seo-aeo', channel: 'SEO / AEO', status: 'planned', goal: 'Build helpful source-backed pages that can answer buyer questions and AI-search prompts.', guardrail: 'No fake expertise, citations, locations, inventory, or reviews.', nextAction: 'Inventory current project pages and missing high-intent questions.' },
    { id: 'email-outreach', channel: 'Email / dealer outreach', status: 'approval_required', goal: 'Draft compliant outreach and follow-up sequences.', guardrail: 'No customer/dealer email send without explicit approval object/scope.', nextAction: 'Prepare drafts and approval request template only.' },
    { id: 'paid-social', channel: 'Paid ads / boosted social', status: 'approval_required', goal: 'Queue hypotheses, creatives, targeting notes, and spend caps.', guardrail: 'No spend, publish, or campaign-setting mutation without explicit approval.', nextAction: 'Build experiment board entries with metric + approval requirement.' },
  ]

  const tools: MarketingTool[] = [
    { id: 'mission-control', name: 'Mission Control', category: 'campaign command', status: 'staged', safetyNote: 'Owns queue, approvals, receipts, project tabs, and honest instrumentation status.' },
    { id: 'hermes-skills', name: 'Hermes skills/plugins inventory', category: 'agent capability', status: 'installed', safetyNote: 'Use for internal drafting/research; no external sends or spend without approval.' },
    { id: 'analytics-sources', name: 'Analytics sources', category: 'measurement', status: 'blocked', safetyNote: 'Not Instrumented Yet for most project marketing surfaces; do not fake live metrics.' },
    { id: 'marketplaces', name: 'Marketplace/listing tools', category: 'distribution', status: 'not_adopted', safetyNote: 'External posting/listing is approval-gated and must preserve platform compliance.' },
  ]

  const templates: MarketingTemplate[] = [
    { id: 'offer-brief', title: 'Offer + ICP brief', kind: 'strategy', status: 'planned', useCase: 'Per-project marketing tab starter: offer, buyer, pain, proof, CTA, risk reversal.' },
    { id: 'landing-wireframe', title: 'Landing page wireframe', kind: 'copy', status: 'planned', useCase: 'Hero, proof, pain, process, objections, CTA, FAQ, compliance notes.' },
    { id: 'approval-request', title: 'External action approval request', kind: 'governance', status: 'planned', useCase: 'Scope, channel, blast radius, spend/send/post action, proof plan, rollback/stop plan.' },
    { id: 'experiment-card', title: 'Campaign experiment card', kind: 'testing', status: 'planned', useCase: 'Hypothesis, audience, channel, metric, status, evidence, result/learning.' },
  ]

  const experiments: MarketingExperiment[] = [
    { id: 'blackwire-positioning', project: 'Blackwire', hypothesis: 'A command-truth demo promise outperforms generic AI-agent language for operator trust.', channel: 'landing/page copy', status: 'planned', successMetric: 'Qualified demo intent or Chris-approved conversion proxy', evidence: 'Evidence Missing: no live campaign instrumentation yet.', approvalRequired: false },
    { id: 'material-solutions-listing-trust', project: 'Material Solutions / David', hypothesis: 'Proof-first equipment listing pages increase calls/messages from qualified buyers.', channel: 'website / marketplace draft', status: 'approval_required', successMetric: 'Lead conversion rate by source once analytics exists', evidence: 'Not Instrumented Yet: analytics/source attribution not wired.', approvalRequired: true },
  ]

  const projectProfiles: ProjectMarketingProfile[] = [
    { id: 'blackwire', project: 'Blackwire', offer: 'Mission Control / agent-ops command system', audience: 'Founder/operator running multi-agent workflows', status: 'planned', analyticsStatus: 'Not Instrumented Yet', approvalsRequired: ['External publish', 'paid campaign spend'], nextAction: 'Draft offer/ICP and command-truth demo landing sequence.' },
    { id: 'mission-control', project: 'Mission Control', offer: 'Daily-driver control plane for Vortex Ventures operations', audience: 'Internal Vortex/Blackwire operators first', status: 'planned', analyticsStatus: 'Manual', approvalsRequired: ['Public launch copy'], nextAction: 'Keep product proof ahead of public marketing claims.' },
    { id: 'material-solutions', project: 'Material Solutions / David', offer: 'Equipment inventory, dealer outreach, AI intake/phone support', audience: 'Forklift/equipment buyers and dealers', status: 'approval_required', analyticsStatus: 'Not Instrumented Yet', approvalsRequired: ['Customer/dealer email', 'marketplace post', 'ad spend', 'David/customer-facing copy changes'], nextAction: 'Prepare drafts only; do not send/post/spend without approval.' },
  ]

  const externalActionGuardrails = [
    'No auto-send email/SMS/customer/dealer outreach without explicit approval object.',
    'No social post, marketplace listing, paid ad, campaign setting mutation, or spend without explicit approval/scope.',
    'Missing analytics must say Not Instrumented Yet; campaign status must not imply live results.',
    'David/Material Solutions marketing remains isolated from Vortex/Blackwire internal memory.',
  ]

  return {
    generatedAt,
    status: 'partial' as const,
    summary: {
      principles: principles.length,
      playbooks: playbooks.length,
      tools: tools.length,
      templates: templates.length,
      experiments: experiments.length,
      projectProfiles: projectProfiles.length,
      externalActionsApprovalGated: true,
    },
    principles,
    playbooks,
    tools,
    templates,
    experiments,
    projectProfiles,
    externalActionGuardrails,
  }
}
