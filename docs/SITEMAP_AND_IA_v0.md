# Mission Control — Sitemap + IA v0

**Owner:** Patch (UI / IA lane)
**Reviewer for truth contract:** Herm
**Implementer:** Coda
**Built on:** Existing Next.js App Router app at `/Users/vortexventures/Desktop/Vortex Ventures/VVMissionControlOps/mission-control`
**Authority:** UI / design only. No truth claims, no DB schema invention. Anchored on Herm's BUILD_COMMAND + GROUP_CHAT_CONTRACT + IDEAS_AND_METRICS_INTAKE.
**Live finish line this v0 covers:** Command Truth v0 (four tabs) + Group Chat v0 (Command + Blackwire + Agent DMs + Tracker + Receipts) inside the existing app shell, with Metrics v1 and project HQs reserved as next-slice space.

---

## ASCII tree (read this on your phone)

```
Mission Control
├─ /login                          (auth: existing)
├─ /setup                          (onboarding: existing)
│
├─ APP SHELL (persistent on every authenticated route)
│   ├─ Left rail (NavRail) — group toggles, Essential/Full mode
│   ├─ Header bar — breadcrumb · search · approval queue · alerts · user
│   ├─ Live feed strip (collapsible, top-right) — current run/heartbeat
│   ├─ Banner stack — local-mode / openclaw-doctor / update / promo
│   └─ Modal layer — exec-approval overlay · project manager · onboarding
│
├─ COMMAND  (group, no header label — core)
│   ├─ /overview                   Dashboard tiles + pinned finish lines
│   ├─ /command-truth              ★ NEW Command Truth v0
│   │   ├─ ?tab=routes             Canonical Routes (list + row drill)
│   │   ├─ ?tab=agents             Agent Registry  (list + row drill)
│   │   ├─ ?tab=projects           Project Status  (list + row drill)
│   │   └─ ?tab=memory             Memory Systems  (list + row drill)
│   ├─ /command-truth/agents/:id   Agent detail panel (drill-down)
│   ├─ /command-truth/projects/:id Project detail panel (drill-down)
│   └─ /command-truth/routes/:slug Route detail panel (drill-down)
│
├─ COMMS  (group, replaces standalone "chat" — core)
│   ├─ /rooms                      Group Chat home (rooms list + first room)
│   ├─ /rooms/command              Command Room (Chris + Patch + Herm + Coda)
│   ├─ /rooms/blackwire-ops        ★ Blackwire Ops Room (v0 demo room)
│   ├─ /rooms/:slug                Project / system rooms (generic)
│   ├─ /dms                        Agent DMs index (cards)
│   ├─ /dms/:agentId               Agent DM thread
│   ├─ /tracker                    Assignment Tracker Board (cross-room)
│   ├─ /receipts                   Decision Receipts log (cross-room)
│   └─ /archive/mailman            Read-only Mailman archive (Day-1 scope)
│
├─ AGENTS  (group — core)
│   ├─ /agents                     Squad Panel (existing AgentSquadPanelPhase3)
│   └─ /agents/:id                 Agent detail (existing AgentDetailTabs)
│
├─ WORK  (group — core)
│   ├─ /tasks                      Task board (existing)
│   ├─ /skills                     Skills inventory
│   ├─ /memory                     Memory browser
│   └─ /research                   Research intake
│
├─ OBSERVE  (group — existing)
│   ├─ /activity   /dispatch   /history   /logs
│   ├─ /cost-tracker   /expenses
│   ├─ /nodes   /exec-approvals   /content-research
│   ├─ /office   /app-factory   /monitor
│   └─ Reserved: /metrics (Metrics v1 entry — empty placeholder OK)
│
├─ AUTOMATE  (group — existing)
│   └─ /cron   /webhooks   /alerts   /github
│
├─ HUBS  (group — RESERVED, not built v0)
│   ├─ /hubs/material-solutions    MSNJ hub (David page lives inside)
│   ├─ /hubs/material-solutions/david   David runtime page
│   ├─ /hubs/blackwire             Blackwire Ops HQ (chain-of-command map)
│   ├─ /hubs/blackwire/projects/:id     Per-project tab (agent role + tasks)
│   └─ /hubs/trading               Trading Operations surface
│
└─ ADMIN  (group — existing)
    ├─ /security   /users   /audit
    ├─ /gateways   /gateway-config
    ├─ /integrations   /debug
    └─ /settings
```

---

## 1. Page inventory (purpose · 1 line each)

### Auth & onboarding (existing, no UI changes v0)
| Route | Purpose |
|---|---|
| `/login` | Operator login (Google + email). Existing. |
| `/setup` | First-run onboarding wizard. Existing. |
| `/onboarding` overlay | OnboardingWizard modal — replays via shell. Existing. |

### Command Truth v0 — NEW
| Route | Purpose |
|---|---|
| `/command-truth` | Four-tab truth surface; default tab = routes. |
| `/command-truth?tab=routes` | Canonical Routes list per Herm contract. |
| `/command-truth?tab=agents` | Agent Registry list per Herm contract. |
| `/command-truth?tab=projects` | Project Status list per Herm contract. |
| `/command-truth?tab=memory` | Memory Systems list per Herm contract. |
| `/command-truth/routes/:slug` | Single route detail: evidence, last verified, blocker. |
| `/command-truth/agents/:id` | Single agent detail: SOUL, MEMORY, runtime, capabilities, evidence. |
| `/command-truth/projects/:id` | Single project detail: working live / not working / blocker. |
| `/command-truth/memory/:layer` | Single memory layer detail: adoption proof. |

### Group Chat v0 — REPLACES `/chat`
| Route | Purpose |
|---|---|
| `/rooms` | Rooms index — left rail rooms list + last-active room body. |
| `/rooms/command` | Command Room (Chris + lead agents). |
| `/rooms/blackwire-ops` | Blackwire Ops Room — v0 demo target room. |
| `/rooms/:slug` | Generic project / system room. |
| `/dms` | Agent DMs index — agent profile cards grid. |
| `/dms/:agentId` | DM thread with one agent. |
| `/tracker` | Cross-room Assignment Tracker Board (kanban). |
| `/receipts` | Decision Receipts log, filterable by room/approver/tier. |
| `/archive/mailman` | Read-only Mailman folder browser (Inbox/Outbox/Messages). |

### Existing surfaces preserved (no UI rework v0 unless cleanup-touched)
Overview, Agents, Tasks, Skills, Memory, Research, Activity, Dispatch, History, Logs, Cost Tracker, Expenses, Nodes, Exec Approvals, Content Research, Office, App Factory, Monitor, Cron, Webhooks, Alerts, GitHub, Security, Users, Audit, Gateways, Gateway Config, Integrations, Debug, Settings.

### Reserved space (NOT built v0)
| Route | Purpose | Status |
|---|---|---|
| `/metrics` | Metrics v1 cockpit (web traffic, David analytics, model usage) | empty stub → "Not Instrumented Yet" |
| `/hubs/material-solutions` | MSNJ hub | reserved card on overview |
| `/hubs/material-solutions/david` | David page | reserved |
| `/hubs/blackwire` | Blackwire Ops HQ visual workflow | reserved |
| `/hubs/blackwire/projects/:id` | Per-project agent role + task list | reserved |
| `/hubs/trading` | Trading Operations | reserved |

---

## 2. Hierarchy / parent–child relationships

The existing app uses a single optional catch-all route: `src/app/[[...panel]]/page.tsx`. Every "page" above is a **panel ID** resolved inside that catch-all, not a separate Next.js page file. This is critical: Coda does NOT need to create new top-level routes — they create new panel IDs and case branches.

```
[[...panel]]/page.tsx           ← single shell entry
   ├─ <NavRail/>                ← left rail, gets new entries: command-truth, rooms, tracker, receipts
   ├─ <HeaderBar/>              ← gets new breadcrumb + tab awareness
   ├─ <LiveFeed/>               ← unchanged
   ├─ <Banner stack/>           ← unchanged
   └─ <PanelSwitch panel=…>     ← switch on panel id; we add new cases:
        ├─ "command-truth"      → <CommandTruthPanel tab=…/>
        ├─ "rooms"              → <RoomsPanel slug=…/>
        ├─ "dms"                → <DMsPanel agentId=…/>
        ├─ "tracker"            → <TrackerBoardPanel/>
        ├─ "receipts"           → <ReceiptsLogPanel/>
        ├─ "archive/mailman"    → <MailmanArchivePanel/>
        └─ existing cases unchanged
```

Drill-downs (`/command-truth/agents/:id`) render as **side-sheet** layered over the list, NOT a new page transition — preserves grid context and supports keyboard nav between rows. This matches the Linear-grade spec.

---

## 3. User flows (entry → typical path → exit)

### Flow A — Chris opens app cold, wants daily-driver truth check
```
/login → (post-auth)
/overview                       ← dashboard tiles, pinned finish lines
   click "Command Truth" tile or nav → /command-truth?tab=routes
   skim 4 tabs                  ← routes / agents / projects / memory
   click row with red status    → /command-truth/agents/david   (side-sheet)
   read evidence + next action  ← truth received
exit: closes sheet, navigates back to overview, OR jumps to relevant room
```

### Flow B — Blackwire Ops demo (v0 group chat acceptance)
```
/overview → click Blackwire Ops tile (or Comms → Blackwire)
/rooms/blackwire-ops
   pin shows: finish line · owner · blocker
   Chris types message → enter
   message stream shows: sent → delivered → seen   ← v0 proof
   Chris @-mentions agent with action verb (e.g. "@coda build …")
   right panel: new Assignment Tracker item appears, status=created
   agent (offline simulation) → message goes to queued_alerts
   important instruction → Chris hits "create receipt" → row in /receipts
exit: Chris closes, message persists, archive holds it.
```

### Flow C — Quick agent ping (DM)
```
nav → /dms
profile card grid (online_proven · queued · offline · unknown)
click agent card → /dms/:agentId
typed message → sent/delivered/seen
@mention with action verb → pulls into /tracker
exit: back to /dms or jump to /rooms.
```

### Flow D — Approval gate (cross-room)
```
agent posts message marked priority=approval_needed in any room
header-bar approval queue badge increments
Chris clicks badge → ExecApprovalOverlay (existing modal)
approve / deny / hold      ← Tier 1 vs Tier 2 enforced by approval_tier
on approve: decision_receipt row created → /receipts
exit: modal closes, room shows updated state.
```

### Flow E — Empty-state honesty
```
any panel without instrumentation → renders <NotInstrumentedYet>
   shows: layer name · last attempted source · NEXT ACTION text
NEVER shows fake numbers or fake green.
```

### Flow F — Old Mailman read-only fallback
```
/archive/mailman   ← preserved as read-only browser of existing folders:
   VVDispatchOps/Dispatch_Inbox/, …_Messages/
   VVHermsOps/Dispatch_Inbox/, …_Messages/
   VVAxeOps/Dispatch_Inbox/, …_Messages/
no send / no edit / no delete.   useful for continuity until ingestion is built.
```

---

## 4. Shared shell elements (persistent across every authenticated route)

| Element | Component (existing) | v0 changes |
|---|---|---|
| Left nav rail | `nav-rail.tsx` | ADD: command-truth, rooms (replaces chat), tracker, receipts. RESERVE: metrics, hubs. |
| Top header bar | `header-bar.tsx` | ADD: tab-aware breadcrumb (panel + sub-tab), approval queue badge. |
| Live feed strip | `live-feed.tsx` | unchanged. |
| Banner stack | `local-mode-banner`, `openclaw-doctor-banner`, `openclaw-update-banner`, `update-banner`, `promo-banner` | unchanged. |
| Modal layer | `project-manager-modal`, `exec-approval-overlay`, `onboarding-wizard` | reuse for receipts modal + new approval flows. |
| Empty-state component | NEW `<NotInstrumentedYet/>` | required everywhere uninstrumented. |
| Error boundary | `ErrorBoundary` | unchanged; per-panel scope. |
| Loading skeleton | `Loader` | use across new panels. |

### Breadcrumb pattern (header bar)
`Group · Page · Sub-tab · Item` — e.g. `Command · Command Truth · Agents · david`

### Search (top header)
Global search v0 spans rooms, tracker items, decision receipts, and command-truth rows. Surface as `⌘K` palette. Mailman archive search stays scoped to `/archive/mailman` v0.

---

## 5. Data dependencies per page

Anchored on Herm's GROUP_CHAT_CONTRACT entities and the Command Truth field schemas. Coda implements; Herm seeds.

### Command Truth panels
| Panel | Reads from | Writes? |
|---|---|---|
| `/command-truth?tab=routes` | `canonical_routes` (new) — fields per BUILD_COMMAND §1 | seed only (Herm) |
| `/command-truth?tab=agents` | `agent_registry` (new) — fields per BUILD_COMMAND §2; can join existing `agents` | seed only |
| `/command-truth?tab=projects` | `project_status` (new) — fields per BUILD_COMMAND §3; join existing `projects` | seed only |
| `/command-truth?tab=memory` | `memory_systems` (new) — fields per BUILD_COMMAND §4 | seed only |
| Drill-down `/agents/:id` etc. | same tables, single row + linked evidence rows | read-only |

### Group Chat panels
| Panel | Reads from | Writes? |
|---|---|---|
| `/rooms` | `rooms`, `messages` (latest per room), `message_delivery_state`, `agent_profile_cards` | none |
| `/rooms/:slug` | `rooms`, `messages`, `message_delivery_state`, `assignment_tracker_items` (right panel), `decision_receipts` (right panel) | INSERT messages on send (Tier 1); delivery_state transitions |
| `/dms`, `/dms/:agentId` | `agent_dm_threads` (per GROUP_CHAT_CONTRACT alt name), `messages`, `agent_profile_cards` | INSERT messages |
| `/tracker` | `assignment_tracker_items` cross-room | UPDATE status (Tier 1) |
| `/receipts` | `decision_receipts` | INSERT on Chris-explicit (Tier 2) actions |
| `/archive/mailman` | filesystem READ-ONLY: `~/Desktop/Vortex Ventures/VV*Ops/Dispatch_Inbox*/` | none |
| `/rooms/*` queued alerts | `queued_alerts` table | INSERT on offline send |

### Reserved space (no data v0)
`/metrics`, `/hubs/*` panels render `<NotInstrumentedYet>` referencing Metrics v1 plan in IDEAS_AND_METRICS_INTAKE. Reserve API folders: `/api/metrics/*`, `/api/hubs/*`.

---

## 6. Empty / error / loading states (per-panel)

Every new panel MUST handle these three states without faking data:

- **Loading:** `<Loader/>` skeleton matching the panel grid (no spinner-only).
- **Empty (uninstrumented):** `<NotInstrumentedYet layer="…" lastAttempt="…" nextAction="…"/>`. Forbidden: zeroed charts, sample fake rows, "0 of 0".
- **Error:** in-panel error card with copyable error id + "Report to Herm" link to file a quick-comm. Forbidden: full-screen white pages.

Status pill semantics (used in Command Truth + room headers + agent cards):
- `WORKING LIVE` (green) — only with runtime evidence row.
- `NOT WORKING` (red) — exact missing/blocker text required.
- `NOT INSTRUMENTED YET` (gray) — instrumentation absent; not failure.
- `UNKNOWN` (amber) — pending verification.

---

## 7. Decisions made (Patch authority — UI/IA only)

1. **One catch-all panel route, panel-IDs internally.** Don't fight the existing architecture; extend `[[...panel]]/page.tsx`.
2. **Tabs inside Command Truth use query params (`?tab=`)**, not nested routes — keeps shareable URLs and matches existing pattern.
3. **Drill-downs render as side-sheet**, not page-transition. Faster, preserves list context, friendlier with Linear-grade aesthetic.
4. **Group Chat replaces `/chat`** (rename redirect: `/chat → /rooms`). Chat-page-panel is deprecated v0; chat-panel component reused inside RoomsPanel.
5. **Agent DMs are a sibling to rooms**, not a tab inside rooms. DMs need their own quiet-rail.
6. **Tracker + Receipts get top-level routes** (not buried inside a room). They're cross-room first-class.
7. **Mailman archive lives at `/archive/mailman`** as read-only filesystem browser; not in nav-rail core, only in Comms group footer link.
8. **Hubs are reserved**, not built. Overview surfaces them as locked tiles labeled `Coming v1`.

---

## 8. Open questions for Herm (truth-contract review)

1. **Canonical Routes table source-of-truth:** new SQLite table seeded by Herm, or fixture JSON until DB migration ships? I'm assuming new tables; flag if you want fixture-only v0.
2. **`agent_profile_cards.status` semantics:** is `online_proven` driven by heartbeat row presence, or by a runtime-probe job? Need the proof source nailed before the dot-color renders.
3. **Mailman archive scope:** read VV*Ops/Dispatch_Inbox/* only, or also include `_Messages/` and Outbox folders? I sized v0 to read all four directory shapes.
4. **Receipts tier rendering:** show `chris_explicit` receipts in a separate pinned section, or interleave chronologically with a tier badge? My default is interleave + tier badge.
5. **Approval queue badge in header-bar:** does it count Tier 1 + Tier 2 together, or only Tier 2? My default is both, with a separator dot.
6. **Search index source:** SQLite FTS over messages + tracker + receipts only, or also include canonical-routes notes? My default is messages+tracker+receipts v0.

---

## 9. Confidence

- IA structure: **88%** — anchored on existing nav-rail, BUILD_COMMAND, GROUP_CHAT_CONTRACT.
- Empty/error/loading discipline: **95%** — explicit and enforceable.
- Hubs / Metrics reservation: **80%** — sized correctly but Coda will need micro-decisions when building.
- Mailman archive boundary: **75%** — depends on Q3 above.

---

## 10. Hand-off-to-Coda checklist

- [ ] New panel IDs registered in `nav-rail.tsx`: `command-truth`, `rooms`, `dms`, `tracker`, `receipts`, `archive/mailman`.
- [ ] Panel switch cases added to `src/app/[[...panel]]/page.tsx`.
- [ ] New components scaffolded: `CommandTruthPanel`, `RoomsPanel`, `DMsPanel`, `TrackerBoardPanel`, `ReceiptsLogPanel`, `MailmanArchivePanel`, `NotInstrumentedYet`.
- [ ] `/chat` → `/rooms` redirect.
- [ ] Side-sheet primitive added (reuses `ProjectManagerModal` patterns).
- [ ] Status-pill component standardized: WORKING LIVE / NOT WORKING / NOT INSTRUMENTED YET / UNKNOWN.
- [ ] Header-bar gets approval-queue badge + tab-aware breadcrumb.
- [ ] All new panels render `<NotInstrumentedYet/>` until Herm seeds data.

---

**End of v0 sitemap.** Next slice = wireframes per page (Patch) → visual tokens / Linear-grade theme (Patch) → Coda implementation.
