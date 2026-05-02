# Existing Mission Control — Feature Audit

**Author:** Patch (UI / IA lane)
**Time:** 2026-05-01 21:05 EDT
**Source paths:** `mission-control/src/app/`, `mission-control/src/components/`, `mission-control/messages/en.json`
**Goal:** capture every existing surface worth preserving so reconciliation against Chris's full feature list does not silently drop value.
**Counts:** **49 panels** · **11 dashboard widgets** · **154 API routes** across **70+ API namespaces** · **App Router** with single catch-all + 4 standalone routes (`/login`, `/setup`, `/docs`, `/gekko`).

---

## A. App shell + navigation (already excellent — preserve as-is)

| Component | Path | Standout features |
|---|---|---|
| Catch-all panel router | `src/app/[[...panel]]/page.tsx` | Single shell entry; panels resolve via `panel` segment. Drives ~45 panel switch cases. Strong pattern — extend it. |
| Nav-rail | `src/components/layout/nav-rail.tsx` | 4 groups (core / OBSERVE / AUTOMATE / ADMIN), Essential vs Full mode toggle, mobile bottom-bar via `priority:true`, expandable parent items. |
| Header bar | `src/components/layout/header-bar.tsx` | Top utility bar — logo, search, breadcrumbs. Needs tab-aware breadcrumb + approval-queue badge for v0. |
| Live feed strip | `src/components/layout/live-feed.tsx` | Rolling event ticker. Already wired to `useServerEvents`. |
| Banner stack | `local-mode-banner` · `openclaw-doctor-banner` · `openclaw-update-banner` · `update-banner` · `promo-banner` | Stacked top-of-app banners for environment + update state. |
| Modal layer | `project-manager-modal` · `exec-approval-overlay` · `onboarding-wizard` | Reusable modal primitives — receipt modals, approval gates can reuse. |
| WebSocket + Server-events | `lib/websocket.ts`, `lib/use-server-events.ts` | Real-time signaling already wired; foundation for chat sent/delivered/seen. |
| Plugin panels | `lib/plugins.ts` (`getPluginPanel`, `getPluginNavItems`) | Plugins can register their own panels + nav entries. Powerful escape hatch for hubs. |

---

## B. Auth / onboarding / setup

| Route / panel | Purpose | Standout |
|---|---|---|
| `/login` | Operator login | Existing standalone route. |
| `/setup` | First-run wizard | Existing standalone route. |
| `OnboardingWizard` modal | Replayable onboarding overlay | 9-step flow: auth → capabilities → config → connect → agents → sessions → projects → memory → skills. |
| `/api/auth/*` | login, logout, me, google, users, access-requests | Full auth API including access-request flow. |
| `/api/gnap/*` | GNAP (Grant Negotiation and Authorization Protocol) | Modern grant-based auth — preserve. |
| `/api/onboarding`, `/api/setup` | wizard state + setup config | |

---

## C. Dashboard widgets (`components/dashboard/widgets/`)

| Widget | Purpose | Worth preserving? |
|---|---|---|
| `metric-cards-widget` | KPI tiles | Yes — base for Metrics v1. |
| `event-stream-widget` | Live event ticker | Yes — feeds rooms + activity. |
| `task-flow-widget` | Task progression visualization | Yes — feeds Tracker board. |
| `runtime-health-widget` | Provider/runtime status pills | Yes — feeds Command Truth. |
| `gateway-health-widget` | Gateway up/down | Yes — Admin signal. |
| `github-signal-widget` | GitHub repo signal | Yes — feeds Project Status. |
| `security-audit-widget` | Security signals | Yes. |
| `session-workbench-widget` | Active Claude sessions | Yes — feeds Agent Workbench. |
| `quick-actions-widget` | Action shortcuts | Yes — feeds Command Room. |
| `maintenance-widget` | Maintenance / housekeeping | Reserve. |
| `onboarding-checklist-widget` | Onboarding state | Keep. |
| `widget-grid.tsx` + `widget-primitives.tsx` (SignalPill, getProviderHealth, getMcHealth) | Composable widget grid + status pills | **Reuse** for `<NotInstrumentedYet>` and Command Truth status pills. |

---

## D. Panels — 49 existing surfaces

Grouped by likely v0.1 destination after reconciliation with Chris's full list.

### D.1 Maps directly to NEW v0 surfaces (reuse, don't rewrite)
| Panel | Maps to | Notes |
|---|---|---|
| `chat-page-panel` + `chat-panel` + `chat-workspace` + `conversation-list` + `message-bubble` + `message-list` + `chat-input` | `/rooms`, `/dms` | Rich chat primitives already exist — Group Chat v0 reuses them, adds rooms/tracker/receipts shell. |
| `agent-comms-panel` | `/rooms` agent-to-agent visibility | Already shows agent feed. |
| `agent-squad-panel-phase3` | `/agents`, `/command-truth?tab=agents` | Phase-3 squad UI is the most current. |
| `agent-detail-tabs` | `/agents/:id`, `/command-truth/agents/:id` | Tabbed agent detail — perfect for drill-down. |
| `agent-history-panel` | `/agents/:id` history tab | Per-agent timeline. |
| `agent-cost-panel` | `/cost-tracker` filtered by agent | Per-agent cost breakdown. |
| `task-board-panel` | `/tasks` AND `/tracker` | Existing kanban — extend for cross-room Assignment Tracker. |
| `dispatch-inbox-panel` | `/archive/mailman` (read-only) AND `/rooms` ingestion | Already reads dispatch inbox. |
| `exec-approval-panel` + `ExecApprovalOverlay` modal | `/exec-approvals` AND header approval-queue badge | Approval system already exists — extend with tier semantics. |
| `notifications-panel` | Notifications cockpit + Telegram mirror | Existing. |
| `audit-trail-panel` | `/audit` + decision-receipts cross-link | Preserve. |
| `memory-browser-panel` + `memory-graph` | `/memory`, `/command-truth?tab=memory` | Memory graph is a standout visual. |
| `cost-tracker-panel` + `token-dashboard-panel` | `/cost-tracker` + Metrics v1 | Token usage already wired. |
| `expenses-panel` | `/expenses` + Metrics v1 finance | Recently added (post-relocation). |
| `cron-management-panel` | `/cron` | Schedule management. |
| `webhook-panel` | `/webhooks` | Webhooks deliveries + retry + verify. |
| `alert-rules-panel` | `/alerts` | Alert rules. |
| `github-sync-panel` | `/github` | GitHub issues sync. |
| `skills-panel` | `/skills` + capability inventory | Skills Hub. |
| `historical-timeline-panel` | `/history` | Session/project history. |
| `activity-feed-panel` | `/activity` | Live activity. |
| `log-viewer-panel` | `/logs` | Log viewer. |
| `nodes-panel` | `/nodes` | Per-node/instance status. |
| `system-monitor-panel` | `/monitor` | System health. |
| `standup-panel` | `/standup` (or Command Room pin) | Daily standup. |
| `research-intake-panel` | `/research` | Research intake. |
| `content-research-panel` | `/content-research` | Content research. |
| `documents-panel` | `/docs` (existing standalone too) | Documents browser. |
| `office-panel` | `/office` | Office surface (calendar?). |
| `app-factory-panel` | `/app-factory` | App scaffolding. |
| `settings-panel` | `/settings` | Settings. |
| `super-admin-panel` | `/admin/super` (gated) | Super-admin tier. |
| `user-management-panel` | `/users` | User mgmt. |
| `security-audit-panel` | `/security` | Security audit. |
| `gateway-config-panel` + `multi-gateway-panel` | `/gateways`, `/gateway-config` | Gateway management. |
| `integrations-panel` | `/integrations` | Integrations. |
| `debug-panel` | `/debug` | Debug. |
| `channels-panel` | Notification channels (existing) — distinct from rooms | Keep separate from chat rooms. |
| `local-agents-doc-panel` | `/docs` AGENTS.md | Local agents documentation. |
| `session-details-panel` | Session detail drill | Keep. |
| `orchestration-bar` | Orchestration command bar | Powerful — title in i18n: "Command Deck". |
| `pipeline-tab` | Pipeline runs | Pipelines API exists. |
| `ai-toolkit-panel-v3` + `ai-toolkit-semantic-search` | AI Toolkit + semantic search | **Standout: semantic search across toolkit.** |

### D.2 Standout features (don't drop these)

- **Memory Graph** (`memory-graph.tsx`) — visual node-graph of memory layers. Direct fit for the Memory Systems tab AND for the future Memory/Brain Surface feature in Chris's interview queue.
- **Orchestration bar / "Command Deck"** — top-of-app command bar pattern. Excellent fit for ⌘K palette + cross-room global commands.
- **AI Toolkit semantic search** — vector search over toolkit. Extend to cross-MC global search per GROUP_CHAT_CONTRACT.
- **GNAP auth** — modern grant-based auth alongside Google OAuth. Preserve.
- **Phase 3 Agent Squad** — most current agent UI iteration; v0 should build on phase3, not phase1/2.
- **Agent Detail Tabs primitive** — tabbed drill-down works perfectly for side-sheet pattern in v0.
- **WebSocket + server-events infra** — sent/delivered/seen for Group Chat v0 needs no new transport.
- **Plugin panel registry** (`lib/plugins.ts`) — Hubs (Material Solutions, Blackwire, Trading) can ship as plugins without bloating core.

---

## E. API surface — 154 routes across 70+ namespaces

Worth-preserving namespaces (each is a v0 dependency or a Metrics v1 source):

| API namespace | Powers | Worth preserving |
|---|---|---|
| `/api/auth/*` (5) | login, logout, me, google, users, access-requests | YES — foundation |
| `/api/gnap` | GNAP grant auth | YES |
| `/api/agents/*` | register, sync, message, comms, evals, optimize, [id] | YES — Command Truth + DMs |
| `/api/agents/comms` | agent-to-agent comms | YES — needed for room agent feed |
| `/api/chat/*` (3) | conversations, messages, session-prefs | YES — Group Chat reuse |
| `/api/mentions` | @mentions API | YES — direct fit for Tracker creation |
| `/api/exec-approvals` | approval gates | YES — extend with Tier 1 vs 2 |
| `/api/dispatch/inbox` | dispatch inbox read | YES — `/archive/mailman` reuse |
| `/api/projects/*` | projects + [id] | YES — Project Status tab |
| `/api/tasks/*` (4) | tasks + outcomes + queue + regression | YES — Tracker |
| `/api/memory/*` (5) | context, graph, health, links, process | YES — Memory tab + graph |
| `/api/tokens/*` (2) | by-agent + rotate | YES — Cost Tracker |
| `/api/notifications/*` (1+) | deliver | YES — Telegram mirror |
| `/api/scheduler` + `/api/cron` + `/api/schedule-parse` | scheduling | YES |
| `/api/webhooks/*` (4) | deliveries, retry, test, verify-docs | YES |
| `/api/alerts` | alert rules | YES |
| `/api/audit` | audit trail | YES — receipts cross-link |
| `/api/security-audit` + `/api/security-scan/*` | security | YES |
| `/api/system-monitor` + `/api/diagnostics` + `/api/status` | system health | YES — Command Truth runtime evidence |
| `/api/sessions/*` (3) | sessions + continue + transcript | YES — agent session evidence |
| `/api/claude/*` + `/api/claude-tasks` | Claude session integration | YES — Agent Workbench |
| `/api/hermes/*` (2) | memory + tasks | YES — Hermes lane |
| `/api/openclaw/*` (3) | doctor + update + version | YES — runtime status |
| `/api/skills/*` (1+) + `/api/skills/registry` | skills inventory | YES — Capability Inventory feature |
| `/api/integrations` + `/api/gateways/*` (3) | integration + gateway mgmt | YES |
| `/api/research/intake` + `/api/content-research` | research | YES |
| `/api/expenses/*` (2) | expenses | YES — Finance feature |
| `/api/subscriptions/*` (2) | subscriptions tracking | YES — Finance feature |
| `/api/index` + `/api/search` | search infrastructure | YES — global search v0 |
| `/api/events` | event stream | YES — Live feed |
| `/api/ai-toolkit/*` (2) | search + sync | YES — semantic search reuse |
| `/api/local/*` (3) | agents-doc + flight-deck + terminal | YES — Agent Workbench |
| `/api/super/*` (3) | os-users + provision-jobs + tenants | YES — Super-admin |
| `/api/standup` | standup | YES — Command Room pin |
| `/api/spawn` | spawn agent | YES |
| `/api/quality-review` | quality review | YES |
| `/api/pipelines/*` (1) + `/api/pipelines/run` | pipelines | YES |
| `/api/workflows` | workflows | YES — Multi-agent workflow board (Chris idea #1) |
| `/api/workspaces/*` (2) | workspaces (3-Mac-Studio support, Chris idea #2) | YES — directly maps |
| `/api/workload` | workload | YES |
| `/api/nodes` | per-node | YES |
| `/api/connect` | connection management | YES |
| `/api/cleanup` | cleanup ops | YES |
| `/api/backup` | backup ops | YES |
| `/api/export` | export | YES |
| `/api/releases/*` (2) | check + update | YES |
| `/api/gateway-config` | gateway config | YES |
| `/api/adapters` | adapters | YES |
| `/api/docs/*` (3) | content + search + tree | YES — Docs surface |
| `/api/onboarding` + `/api/setup` | onboarding | YES |
| `/api/logs` | logs | YES |
| `/api/activities` | activity feed | YES |
| `/api/history/*` (3) | daily-notes + projects + sessions | YES |
| `/api/debug` | debug | YES |
| `/api/settings` | settings | YES |
| `/api/gekko` | (gekko surface, standalone route at `/gekko`) | Investigate — likely trading-related (RESERVE for /hubs/trading?). |

---

## F. Existing routes that ALREADY map to Chris's MORE feature set

The features Chris dictated that the v0 sitemap UNDER-specified are mostly already supported by existing APIs:

| Chris feature (interview queue / IDEAS) | Existing infra | Sitemap v0 status |
|---|---|---|
| Multi-agent workflow board | `/api/workflows`, `task-flow-widget`, `agent-squad-panel-phase3` | Under-specified — needs explicit `/workflows` route |
| Three-Mac-Studio + contained workspaces | `/api/workspaces/*` (already exists!) | MISSING — add `/workspaces` |
| Approval / Risk Control System (50 questions) | `/exec-approvals`, `ExecApprovalOverlay`, `/api/exec-approvals` | Under-specified — needs full Approval Hub page |
| Receipts / Evidence / Archive Search | `/api/audit`, `/api/search`, `/api/index` | Under-specified — `/receipts` exists but archive-search is broader |
| Notifications / Queue / Alerting | `notifications-panel`, `/api/notifications/*`, `alert-rules-panel`, Telegram mirror | Under-specified — needs notification hub page |
| Memory / Graphify / Brain Surface | `memory-graph`, `/api/memory/*` | PARTIALLY in sitemap — graph view should be first-class |
| Agent Workbench / Claude Code lanes | `session-workbench-widget`, `/api/claude/*`, `/api/local/flight-deck`, `/api/local/terminal` | MISSING — needs `/workbench` |
| Mobile / Daily Driver UI | `priority:true` mobile bar already in nav-rail | Day 2 — deferred |
| Capability Inventory (skills/plugins/MCPs/tools) | `skills-panel`, `/api/skills/registry`, plugin registry | PARTIALLY — needs capability inventory page beyond skills |
| Material Solutions Hub + David page | Plugin registry can host as plugin | RESERVED in sitemap |
| Blackwire Ops HQ | Plugin registry can host | RESERVED in sitemap |
| Trading Operation | `/api/gekko` + `/gekko` route already exists! | RESERVED in sitemap — confirm Gekko is the trading surface |
| Financial tracking (expenses, revenue, projections, assets) | `expenses-panel`, `/api/expenses`, `/api/subscriptions` | Under-specified — needs `/finance` parent |
| Website / funnel analytics + David analytics + usage per model | NOT YET INSTRUMENTED — `metric-cards-widget` placeholder | Reserved as Metrics v1 — correct call |
| Voice in MC | NONE existing | Day 2 — deferred per Chris answer |

---

## G. Ground rule for reconciliation

Don't drop any of these in v0.1:
1. The catch-all panel router pattern.
2. The 4-group nav-rail with Essential/Full mode toggle.
3. WebSocket + server-events infra (drives sent/delivered/seen).
4. Memory Graph visual.
5. AI Toolkit semantic search (extend to global).
6. Orchestration bar / Command Deck (becomes ⌘K palette).
7. Plugin panel registry (let Hubs ship as plugins).
8. Phase-3 Agent Squad (don't regress to phase1/2).
9. Agent Detail Tabs primitive (drives side-sheet pattern).
10. ExecApprovalOverlay modal (extend with tier semantics, don't replace).
11. Existing chat primitives — `chat-panel`, `message-list`, `message-bubble`, `chat-input`, `conversation-list`, `chat-workspace`.
12. The 154 API routes — every namespace listed in §E is a v0 or Metrics v1 dependency.

## H. Open question for reconciliation

**`/gekko` and `/api/gekko`** — there's a fully-built standalone route at `src/app/gekko/` with its own components in `src/components/gekko/`. This is almost certainly the Trading Operations surface Chris listed. Reconciliation should NOT treat `/hubs/trading` as a fresh build — it should map to existing Gekko, possibly renamed.

---

**End of audit.** Ready to reconcile against Chris's full feature list when Herm's consolidated list arrives or the partial-list synthesis is approved.
