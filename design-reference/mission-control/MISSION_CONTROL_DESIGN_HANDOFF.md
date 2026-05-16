# Mission Control · Design Handoff
**Vortex Ventures / Blackwire Ops HQ — Heavy cyberpunk command center**

This document is the implementation source of truth for the Mission Control redesign. Every other artifact (the prototype HTML, the JSX source) is derivative. If a screen contradicts this doc, the doc wins.

---

## 0 · Scope

A single internal daily-driver command center. ~50 routes, sidebar navigation, dense, receipt-driven, local-first.

**This is not a marketing site.** It is an operator-facing tool. No fake-green status. No silent success. No external mutation in LOCAL mode.

---

## 1 · File Map

The prototype is split into 7 files. Builder agents should mirror this structure (or its equivalent in your target stack):

| File | Role | Notes |
|---|---|---|
| `Mission Control.html` | Entry point + router | Wires routes → page components; persists active route to localStorage |
| `styles.css` | Design tokens + global CSS | Single source of truth for colors, type, panel chrome, motion, reduced-motion fallback |
| `shell.jsx` | App chrome | `VVMark`, `Atmosphere`, `LiveClock`, `AsciiBanner`, `Sidebar`, `TopBar`, `CommandPrompt`, `Sparkbar`, `NAV` route table |
| `hud.jsx` | Shared primitives | `Brackets`, `HudPanel`, `GlitchTitle`, `Gauge`, `Chip`, `BoundaryBanner`, `PageHeader`, `DataTable`, `Stat`, `HudStrip`, `Page`, `Btn` |
| `pages-core.jsx` | Tier 1 — Core HQ (8 pages) | Overview, Mission Control, Command Truth, Group Chat, Blackwire Ops Room, Koda Tracker, Boards, Agents |
| `pages-operator.jsx` | Tier 2 — Operator Flow (5 pages) | Approvals, Notifications, Direct Chat, Receipts/Docs, Expenses |
| `pages-knowledge.jsx` | Tier 3 — Knowledge/Studio (15 pages) | Intake → Memory → Research → Think Tank → Brainstorm → Content → Asset → Design → Marketing → App Factory → Office → Skills → AI Toolkit |
| `pages-control.jsx` | Tier 4 — Control/Admin (12 pages) | Activity, Timeline, Logs, Cost Tracker, Monitor, Trading, Security Center, Security Audit, Audit, Users, Settings, Integrations |
| `pages-extended.jsx` | Tier 5 — Extended Ops (10 pages) | Cron, Webhooks, Alerts, GitHub, Gateways, Gateway Config, Channels, Nodes, Debug, Super Admin |
| `assets/vv-w.png` | Logo crop | Use this exact file — do not re-recreate the logo in SVG |

---

## 2 · Design Token Contract

These are non-negotiable. Port verbatim to your target framework (Tailwind config, CSS modules, styled-components, etc.). All values are in `styles.css`.

### Colors

```css
/* Background field — near-black with deep ambient gradients */
--bg-0:        #05080a;   /* canvas */
--bg-1:        #080d10;   /* slight lift */
--bg-2:        #0c1419;   /* panel base */
--bg-3:        #111d23;   /* hovered panel */

/* Steel — brushed metal echoing the logo */
--steel-0:     #1a242b;
--steel-1:     #2a3a44;
--steel-2:     #3d525e;
--steel-3:     #5a7280;

/* Ink — text scale (high to low contrast) */
--ink-0:       #d8e2e8;   /* primary text */
--ink-1:       #aab8c0;   /* secondary text */
--ink-2:       #6b7e88;   /* labels, captions */
--ink-3:       #475762;   /* disabled, faint */

/* Primary — teal glow (logo accent) */
--teal:        #2ee6d6;
--teal-soft:   #5eead4;
--teal-dim:    #1a8c82;

/* Secondary — purple accent (logo rivets) */
--purple:      #a855f7;
--purple-soft: #c084fc;

/* Status */
--amber:       #f5a524;   /* warnings, pending, needs-evidence */
--rose:        #ff5577;   /* errors, blocked, danger, rejected */

/* Lines */
--grid:        rgba(46, 230, 214, 0.06);
--hairline:    rgba(120, 160, 175, 0.18);
--hairline-2:  rgba(120, 160, 175, 0.32);
```

### Type

```css
--font-mono:   "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace;
--font-disp:   "Rajdhani", "Oxanium", "Eurostile", sans-serif;
--font-text:   "Inter Tight", "Inter", system-ui, sans-serif;
```

- **JetBrains Mono** for all data, labels, IDs, hashes, timestamps, table cells, terminal output.
- **Rajdhani** for headers, page titles, big numbers, panel titles. UPPERCASE + 0.06em letter-spacing for display use.
- **Inter Tight** for body prose only (rare — most copy is mono).
- 13px base. Tables drop to 11px. Mono captions 10–10.5px. Page H1 at 30px. Big numbers (stat values) 24px display.

### Motion

- **LED pulse**: 2.4s ease-in-out, 1.0→0.85 scale, 1.0→0.5 opacity. On every live status indicator.
- **VV logo pulse**: 3.2s ease-in-out, glow-only drop-shadow oscillation.
- **Scanline drift**: 7s linear, soft teal band sweeps top→bottom.
- **Sparkbar breathe**: 3.6s ease-in-out, 1.0→0.55 scaleY.
- **Glitch hover (buttons)**: 320ms steps(2), 1px translate + brief hue-rotate.
- **Glitch hover (text)**: 380ms steps(3), 1–2px translate + cyan/purple split text-shadow.
- **Glitch title** (rare, 7–10s interval): 220ms, text-shadow split with -1px translate.

**Reduced motion:** A `@media (prefers-reduced-motion: reduce)` block collapses all keyframes and transitions to 0.001ms and hides `.mc-scan`. This is in `styles.css` and **must ship to production**.

### Panels (`.bevel`)

The signature visual. Beveled metal panel with hairline highlight + inner shadow + brushed-steel overlay.

```css
.bevel {
  background:
    linear-gradient(180deg, rgba(46,230,214,0.02), rgba(168,85,247,0.02)),
    linear-gradient(180deg, #0e161b 0%, #0a1014 100%);
  border: 1px solid var(--hairline);
  border-radius: 2px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.04),
    inset 0 0 0 1px rgba(0,0,0,0.3),
    0 1px 0 rgba(0,0,0,0.6),
    0 18px 40px -20px rgba(0,0,0,0.8);
}
.bevel::before {  /* brushed highlight along top */ }
.bevel::after  {  /* vertical brush texture */ }
.bevel-glow    {  /* +teal halo for emphasized panels */ }
```

Use `.notched` to add 14px chamfered corners on HUD modules. Use `<Brackets />` to add corner-tick indicators inside any panel.

---

## 3 · Component Inventory

Every reusable primitive — these are floors, not ceilings. Builder agents must use them; never hand-roll equivalents.

### Atomic
| Component | File | Purpose |
|---|---|---|
| `Chip` | hud.jsx | Status pill. Tones: `teal · purple · amber · rose · neutral · dim`. UPPERCASE mono, tight padding. |
| `Btn` | hud.jsx | Button. Variants: `primary` (teal-filled), `danger` (rose), default. Optional `small`. Hover = glitch animation. |
| `LiveClock` | shell.jsx | Live HH:MM:SS, updates every second. |
| `Sparkbar` | shell.jsx | Animated mini bar chart. Props: `count`, `seed`, `height`. Teal with periodic purple bars. |
| `Gauge` | hud.jsx | Circular gauge w/ tick marks. Props: `value` (0–100), `label`, `color`, `size`. |
| `Brackets` | hud.jsx | Corner-tick indicators (positioned `absolute`; parent must be `position: relative`). |

### Layout
| Component | File | Purpose |
|---|---|---|
| `HudPanel` | hud.jsx | THE workhorse. Beveled + notched container with kicker, title, right slot, body. Props: `kicker`, `title`, `right`, `glow`, `padded`. |
| `Page` | hud.jsx | Standard page shell. Slots: `kicker`, `title`, `subtitle`, `badges` (Chip[]), `actions` (Btn[]), `strip` (HudStrip items). |
| `PageHeader` | hud.jsx | Used internally by `Page`. Glitch-titled H1 with subtitle row of badges + actions. |
| `HudStrip` | hud.jsx | Thin breadcrumb-y strip under top bar. Items are arbitrary inline content. |
| `BoundaryBanner` | hud.jsx | THE proof/local-only/draft warning component. Use this anywhere a page has a constraint that breaks SaaS convention. Tones: `amber · rose · teal · purple`. |

### Data
| Component | File | Purpose |
|---|---|---|
| `DataTable` | hud.jsx | Dense table. Columns config: `key, label, render, align, mute, maxWidth, width, wrap`. Rows hover-highlighted. Optional `onRowClick`. |
| `Stat` | hud.jsx | KPI card. Props: `label, value, sub, accent, icon, glow`. |

### Chrome
| Component | File | Purpose |
|---|---|---|
| `VVMark` | shell.jsx | The logo. Always uses `assets/vv-w.png` with `mixBlendMode: screen` + teal drop-shadow. **DO NOT redraw in SVG.** |
| `Sidebar` | shell.jsx | Left nav. Grouped, collapsible, persists scroll. Reads from `NAV` constant. |
| `TopBar` | shell.jsx | Mode pill, breadcrumb, command palette stub (⌘K), session counters, live clock. |
| `Atmosphere` | shell.jsx | The grid + scanline + vignette layers. Always present, behind content. |
| `AsciiBanner` | shell.jsx | The status banner pre-block. Use sparingly — Overview only by default. |
| `CommandPrompt` | shell.jsx | Faux terminal. Commands: `help · status · agents · ping · scan · receipts · clear · whoami`. Builder may extend. |

---

## 4 · Route Table

50 routes total. The `NAV` constant in `shell.jsx` is the canonical source. Five groups:

### CORE HQ
| Route | Page | Purpose |
|---|---|---|
| `/` | Overview | HQ home: priority gates, blockers, agent mesh, approvals, receipts, expenses, command links, command prompt |
| `/mission-control` | Mission Control | Readiness lanes (MVP / PROOF / OPS / SECURITY) with evidence-gated transitions |
| `/command-truth` | Command Truth | **Canonical source of truth.** Route contracts, LOCAL/PROD boundaries, readiness gate definition |
| `/group-chat` | Group Chat | Rooms list + thread + pinned context. Composer with receipt/task/evidence chips |
| `/rooms/blackwire-ops` | Blackwire Ops Room | Dedicated dense operator channel (same shell as group-chat, room=blackwire-ops) |
| `/tracker?agent=koda` | Koda Tracker | Single-agent deep view: assignment, work, receipts, blockers, handoff |
| `/tasks` | Boards | Kanban / list toggle, task cards with P0–P3 priority + evidence-gated done |
| `/agents` | Agents | Roster cards: role, status, scope, load, last receipt |

### OPERATOR
| Route | Page | Purpose |
|---|---|---|
| `/exec-approvals` | Approvals | Risk-tagged queue with approve / reject / needs-evidence states |
| `/notifications` | Notifications | Queue with LOCAL delivery indicators, severity, blocked-attempt visibility |
| `/chat` | Direct Chat | DM threads (agent + person), session/model controls panel |
| `/documents` | Receipts & Docs | Library with search, preview, provenance, hash/source linkage |
| `/expenses` | Expenses | Ledger + subscriptions + budget alerts. Receipt-attached on every charge |

### KNOWLEDGE
| Route | Page | Purpose |
|---|---|---|
| `/knowledge-intake` | Knowledge Intake | Source drop → extracted → review → approved → linked destination |
| `/brain-memory` | Brain / Memory | **Display-only.** Graph health, correction queue, no write controls |
| `/memory` | Memory Browser | Search records, provenance, source type, uses count. Read-only |
| `/research-command` | Research Command | Briefs, citations, source quality, approval gates |
| `/research` | Research Intake | Request form + queue |
| `/think-tank` | Think Tank | Opportunity cards with score + evidence count, promotion gate |
| `/brainstorm` | Brainstorm Wall | Raw ideas in clusters, promote/archive controls |
| `/content-research` | Content Research | Topic queue, citation table, draft-safe outputs |
| `/asset-library` | Asset Library | Asset grid: provenance, rights, tags |
| `/design` | Design Studio | Design tasks with proof links, visual QA |
| `/marketing` | Marketing | **Draft-only.** No live sends. Sim channels only |
| `/app-factory` | App Factory | App pipeline: idea → design → building → ready |
| `/office` | Office | Internal workspace, docs, quick links |
| `/skills` | Skills Registry | Installed skills, safety boundary, install approval gate |
| `/ai-toolkit` | AI Toolkit | Tool registry, prompt vault |

### CONTROL
| Route | Page | Purpose |
|---|---|---|
| `/activity` | Activity | Live event feed, receipt-linked |
| `/history` | Timeline | Day-grouped milestone history with receipt backing |
| `/logs` | Logs | Tail viewer with severity filters |
| `/cost-tracker` | Cost Tracker | KPIs, provider breakdown, trend, budget alerts |
| `/monitor` | System Monitor | CPU / mem / disk / net gauges, service cards |
| `/trading` | Trading Ops | **Research surface.** Watchlist, signals, risk notes. NO execution, no wallet |
| `/security-command` | Security Center | Posture, findings, runtime/auth gates, action queue |
| `/security` | Security Audit | Findings table with severity, evidence, mitigation |
| `/audit` | Audit Trail | Immutable action log, receipt-linked |
| `/users` | Users | Directory, roles, permissions, MFA |
| `/settings` | Settings | Workspace config + env vars (read-only display) |
| `/integrations` | Integrations | Connection health cards (GitHub, Supabase, etc.) |

### EXTENDED
| Route | Page | Purpose |
|---|---|---|
| `/cron` | Cron Jobs | Scheduled jobs with pause/resume gates |
| `/webhooks` | Webhooks | Endpoint list. External URLs marked BLOCKED |
| `/alerts` | Alert Rules | Rule list, trigger conditions |
| `/github` | GitHub Sync | Repo status, commits, perms |
| `/gateways` | Gateways | Provider cards. Standby in LOCAL mode |
| `/gateway-config` | Gateway Config | Routing weights, policy |
| `/channels` | Channels | **Local-unavailable state** — explicit unavailable panel + links |
| `/nodes` | Nodes | **Local-unavailable state** — points to `/monitor` |
| `/debug` | Debug | Env checks, route probes |
| `/super-admin` | Super Admin | Tenant, destructive actions (ALPHA-only, double-confirm) |

---

## 5 · Page-by-Page Feature Map

Each page in the prototype demonstrates a specific layout pattern. Builder agents should preserve these patterns; data shapes are mock but realistic.

| Pattern | Used on | Description |
|---|---|---|
| **HQ Grid** | `/` | Top: 4 gauges + 1 priority-gate panel. Mid: 3 panels (mesh, approvals, group). Bottom: 4 panels (receipts, expenses, links, terminal). |
| **Lane Cards** | `/mission-control`, `/think-tank`, `/app-factory`, `/tasks` (kanban) | 3–4 column grid of `HudPanel`s, each containing stacked task cards with state chip. |
| **Two-Column Detail** | `/exec-approvals`, `/documents`, `/research`, `/koda-tracker`, `/marketing`, `/gateway-config` | Wide list (left) + selected detail (right). |
| **Compact Table** | `/notifications`, `/agents`, `/skills`, `/cron`, `/webhooks`, `/audit`, `/logs`, `/activity`, `/users`, `/memory`, `/cost-tracker` | Single full-width `DataTable` inside `HudPanel`. |
| **Chat** | `/group-chat`, `/rooms/blackwire-ops`, `/chat` | 3-column: rooms/threads · thread · pinned context / session controls. |
| **Card Grid** | `/agents`, `/integrations`, `/asset-library`, `/gateways` | 2–4 column grid of detail cards. |
| **Boundary Page** | `/channels`, `/nodes` | Large amber "UNAVAILABLE" panel + dim grid + links to where the function lives in LOCAL mode. |
| **Gauges Row** | `/monitor`, `/` overview top | 4 gauge panels side-by-side. |
| **Timeline** | `/history` | Vertical day-grouped event timeline with LED dots on a hairline rail. |

---

## 6 · Boundary / Proof Rules

These are the design rules that distinguish Blackwire Ops from any other SaaS dashboard. **Builder agents must honor every one.**

### 6.1 — No fake green

- Never show "OK / All Systems Operational" when the underlying state is unverified or local-only.
- Use `LOCAL`, `STANDBY`, `BLOCKED`, `PENDING`, `NEEDS-EVIDENCE`, `DRAFT-SAFE`, `UNVERIFIED` instead of "Active" or "Healthy" when accuracy demands.
- Top-right of every page: a colored Chip strip telling the operator the truth (`LOCAL-ONLY`, `READ-ONLY`, `DRAFT-SAFE`, `NO LIVE SENDS`, etc.). Never omit.

### 6.2 — Done means proven

- Tasks/lanes do not transition to `verified` without a hash-signed receipt in `/receipts/<hash>.json`.
- A receipt requires: source ID, signer (verifier role, e.g. cipher), source-link audit, operator sign-off (alpha).
- Agent self-reports are not proof.
- `/command-truth` documents the canonical readiness gate.

### 6.3 — Local-only mode is the default

- External sends, provider mutations, payment routes are policy-rejected.
- LOCAL is communicated via:
  - Top bar pill: `MODE · LOCAL-ONLY` (amber)
  - Page badges where relevant
  - `BoundaryBanner` at the top of any page that performs writes
- `/channels` and `/nodes` show explicit unavailable state (not empty state).
- `/webhooks`, `/gateways`, `/integrations` mark external endpoints as `BLOCKED` or `STANDBY`.

### 6.4 — Audit everything

- Every alpha-auth action writes to `/audit`.
- Receipts on chat messages, lane transitions, approvals, secret rotations.
- `/audit` is an immutable view (no edit / delete).

### 6.5 — Risk visibility on approvals

- Every approval row shows risk (`low · med · high`) and state (`awaiting · needs-evidence · approved · rejected`).
- "Approve" is disabled when state is `needs-evidence`.
- Risk=high uses rose, med uses amber.

### 6.6 — Unsafe defaults are off

- Skill install requires approval.
- Cron resume requires approval (see `nightly-receipts-sweep` example).
- Agent scope upgrades (read → write → sign) require approval.
- `extern-bridge` is `disabled` in LOCAL.

### 6.7 — Read-only surfaces are explicit

- `/brain-memory` and `/memory` carry `READ-ONLY` chips and `BoundaryBanner`s.
- Write controls are absent, not just disabled.

---

## 7 · Reusable Primitive Guidance

When a builder agent reaches for a new piece of UI, the first question is: *which primitive does this map to?*

| If you need... | Use |
|---|---|
| A status pill (text + color) | `<Chip tone="...">label</Chip>` — never inline-style a span |
| A page-wide warning | `<BoundaryBanner tone="rose|amber|teal|purple" title="..." />` |
| Any framed container | `<HudPanel kicker="01" title="...">…</HudPanel>` — not raw `<div>` |
| A table | `<DataTable columns={[…]} rows={[…]} />` — columns config object, no hand-rolled `<table>` |
| A KPI / big number | `<Stat label="..." value="..." sub="..." accent="..." />` |
| A circular percent display | `<Gauge value={N} label="..." color="..." />` |
| A button | `<Btn primary|danger small>label</Btn>` — never raw `<button>` |
| A page top | `<Page kicker title subtitle badges actions strip>…</Page>` |
| Live data / animated mini-chart | `<Sparkbar count={N} seed={N} />` |

**Don't reinvent.** If a primitive looks close but slightly off, extend its props before building a one-off.

**Don't hand-recreate the logo.** Always use `assets/vv-w.png` via `<VVMark size={N} />`.

---

## 8 · Builder Implementation Prompt

Paste this into your builder agent's task prompt (adjust paths to match your codebase):

> **Task: implement Mission Control per the design handoff in `MISSION_CONTROL_DESIGN_HANDOFF.md`.**
>
> **Source of truth:**
> - Design tokens & component contracts: `MISSION_CONTROL_DESIGN_HANDOFF.md` § 2–3
> - Route table: § 4
> - Page patterns: § 5
> - Boundary/proof rules: § 6 — **all are non-negotiable**
> - Prototype reference: `Mission Control Prototype.html` (self-contained — open in browser, navigate every route)
>
> **What to build:**
> 1. Port the design tokens (§ 2) into `src/styles/tokens.css` (or your tailwind/styled equivalent). Verify `prefers-reduced-motion` block ships.
> 2. Build the component primitives (§ 3) under `src/components/mc/` as reusable React components. Match prop shape exactly so pages copy 1:1 from the prototype.
> 3. Build the shell (`Sidebar`, `TopBar`, `Atmosphere`, `VVMark`) and wire React Router (or your router) to the route table in § 4.
> 4. Implement each page in § 4, replacing the prototype's mock data with calls to real APIs. Preserve the layout pattern from § 5 for each.
> 5. Apply boundary/proof rules from § 6 to every page — they are visual contracts.
>
> **Constraints:**
> - Use `assets/vv-w.png` for the logo. Do not recreate it in SVG, do not redraw, do not crop.
> - Use the JetBrains Mono + Rajdhani + Inter Tight type stack. Load via Google Fonts.
> - All animation honored except when `prefers-reduced-motion: reduce` — do not strip motion globally.
> - LOCAL mode is the default runtime. PROD-only surfaces (`/channels`, `/nodes`) must show explicit unavailable panels, not empty states.
> - "Done" never displays without a receipt — enforce in the data layer, not just visually.
>
> **Out of scope:**
> - Auth flows beyond what the design shows
> - Real receipt cryptography (use whatever signing scheme the backend prefers; the design assumes hash-signed payloads)
> - Mobile breakpoints (this is a desktop daily-driver; ≥1280px is the design target)
>
> **Done means:**
> - Every route in § 4 loads cleanly with real data
> - Every boundary rule in § 6 visible on the relevant pages
> - Prototype open in one tab + your build open in another, they match on layout, density, and boundary visibility
> - All component primitives in shared package, not duplicated per page

---

## 9 · Assumptions & Intentional Mock-Data Decisions

The prototype uses realistic but mock data. Builder agents should replace these with real shapes, not invent new ones.

### Agents
- 8 agents in roster (`koda · oompa-beta · ariadne · stark · cipher · oompa-alpha · wraith · orcus`)
- 5 active, 2 idle, 1 paused (paused = security-blocked via SC-018)
- Each agent has: role, status, current task, load%, region, scope (read/write/sign), last receipt hash
- **Assumption:** scope is one of 4 values; sign is the highest privilege; alpha is operator-only

### Receipts
- Hash format: `0x` + 6-8 hex chars (e.g. `0xa1f4d2`)
- States: `pending` (drafted, awaiting verifier sign) → `verified` (signed by cipher) → optionally `canonical`
- Every receipt carries: kind, src (agent), task linkage, signer, timestamp, body
- **Assumption:** builder will choose a real hashing scheme; prototype just shows the chip + state

### Tasks (BWO-NNN)
- ID format: `BWO-` + 3 digits
- States: `todo · in-prog · review · verified`
- Priority: `P0 · P1 · P2 · P3` (P0 = blocking, P3 = nice-to-have)
- Lanes: `MVP · PRF · OPS · SEC` (see `/mission-control`)
- **Assumption:** `verified` is gated on receipt linkage in the data layer

### Approvals (AP-NNNN)
- ID format: `AP-` + 4 digits
- Kinds: `route-promote · skill-install · budget-bump · cron-resume · agent-scope · secret-rotate · extern-send`
- Risk: `low · med · high`
- States: `awaiting · needs-evidence · approved · rejected`
- **Assumption:** `extern-send` is always auto-rejected in LOCAL mode (shown as rejected in mock data)

### Security findings (SC-NNN)
- States: `open · fixed`
- Severity: `low · med · high`
- Every finding has an `evidence` field (receipt hash, log path, or audit ID)

### Costs
- 30-day budget: $120 (configurable)
- Mock 30d total: $72.18 (60% of budget — amber state)
- Providers shown: anthropic, openai, supabase, github, vercel

### Routes
- Storage: localStorage key `mc-route` persists active route across reload
- Sidebar group collapse state is per-session (not persisted in prototype, but should be in build)
- **Decision:** route is a plain string ID, not a real URL path. Builder should map `/` etc. to actual React Router routes.

### Local-only mode
- Mock: always LOCAL. PROD mode is acknowledged but not designed in prototype.
- **Decision:** when builder implements PROD, `/channels` and `/nodes` should swap from unavailable panel to their real surface; everything else changes from "BLOCKED" to "active" but design language remains the same.

### Branding
- "VORTEX VENTURES" is the company; "BLACKWIRE OPS" is the HQ context
- Logo: `assets/vv-w.png` — the W mark from the matrix logo, cropped at 1.47:1 aspect with breathing room
- Display in sidebar: VV mark + "VORTEX VENTURES" + "BLACKWIRE OPS · v2.0.1"

### Mock interactions
- Sidebar nav switches active page (real)
- Boards kanban/list toggle (real)
- Approval queue filter (real)
- Notification unread filter (real)
- Document search (real)
- DM thread switcher (real)
- Command prompt commands (real, in-memory)
- Everything else is presentational

---

## 10 · Open Questions for Builder

These are decisions deferred to implementation:

1. **Receipt signing scheme** — Ed25519, ECDSA, or another? Prototype assumes hash-signed JSON.
2. **Audit storage** — append-only file, SQLite, or Postgres with RLS?
3. **Real-time updates** — SSE (as the prototype top-bar hints) or WebSocket?
4. **Skill installation provenance** — npm-style registry, content-addressed, or operator-signed manifests?
5. **`/super-admin` 2nd-alpha confirmation flow** — TOTP, hardware key, or in-app second-operator approval?
6. **Cost tracking source** — provider APIs, local ledger from request logs, or both with reconciliation?
7. **`prefers-color-scheme: light`** — not designed. Recommendation: don't support; this is a dark-only tool.

When in doubt: ask the operator. The design honors operator authority over agents on every surface; the implementation should too.
