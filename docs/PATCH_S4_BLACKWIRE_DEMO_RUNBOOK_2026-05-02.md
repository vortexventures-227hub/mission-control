# PATCH_S4 — Blackwire Demo Runbook + Evidence Capture Spec + Not-Instrumented-Yet Component

**Stamp:** 2026-05-02 09:30 EDT
**Owner:** Patch (design / product / scope coherence)
**Implementer:** Koda (canonical mission-control repo)
**Verifier:** Herm (truth contracts, anti-fake-green gate)
**Falsifier:** Neon Forge / Axis (false-green QA)
**Canonical repo:** `/Users/vortexventures/Desktop/Vortex Ventures/VVMissionControlOps/mission-control`
**Canonical runtime under test:** `http://127.0.0.1:3104` (Next dev process, cwd = canonical relocated repo)

---

## Why this exists

Herm's 08:14 EDT verification proved every individual gate passes on canonical 3104:
- typecheck PASS
- authenticated `GET /api/group-chat/rooms?room=blackwire-ops` returns HTTP 200 JSON
- authenticated `/` returns 200 HTML with MC shell
- evidence-gated Done blocks 400 without evidence and 200 with evidence
- DB has `rooms=4 / messages=5 / deliveries=15 / assignments=2 / receipts=2 / agentProfiles=5 / queuedAlerts=1`

What does NOT exist: a single canonical end-to-end run-through with attached evidence that satisfies the Build Bible's 10-step "first integrated demo" flow. Without that, every actor (Koda, Neon Forge, Herm) produces a slightly different artifact and the corrective-slice loop continues.

This document is that artifact. It is the single target Koda implements to, Neon Forge falsifies against, and Herm signs off on. No new feature scope. No system-truth claims. No env or runtime ownership (those live in Herm/Koda lanes per Build Bible).

**Boundary:** Patch design/product authority only. No DB schema invention; no runtime decisions. Anchored on Build Bible v0 + Herm decision contracts already in the inbox.

---

## 1. Demo runtime contract

| Item | Value |
|---|---|
| Authoritative runtime | `http://127.0.0.1:3104` from canonical relocated repo cwd |
| Auth | session cookie `mc-session` (HTTP) or `__Host-mc-session` (HTTPS) — `POST /api/auth/login` flow |
| Auth credentials | env-seeded `AUTH_USER`/`AUTH_PASS` per `.env` (default user `admin`) |
| Demo room | `blackwire-ops` |
| Acceptance against port 3000 | NOT a demo blocker. Port 3000 still listens on legacy listeners (PID 1726 cwd `VVAxeOps/mission-control`, PID 1803 cwd `Projects/telegram-claude-bot`). Herm explicitly held back on killing them. Treat port 3000 as a separate "user-facing routing" track that does NOT block "demo proven." |
| Typecheck gate | `pnpm run typecheck` MUST PASS at the moment of demo capture |

**Implication:** the demo is proven when the 10 frames below are captured against `:3104` under an authenticated session, AND the receipt template at §4 is filed. Port-3000 ownership is a separate, parallel track.

---

## 2. Build Bible 10-step demo → exact gates

Each row maps Herm's Build Bible "First integrated demo" line to exact MC URL, API call, DB row, and required screenshot frame. Every row must be captured for "demo proven."

| # | Demo step | URL | API call | DB row created/touched | Frame ID |
|---|---|---|---|---|---|
| 1 | Open Command Truth | `GET /command-truth?tab=routes` | `GET /api/command-truth/routes` (or feature-detected fallback — see §6 if route is missing) | none (read-only) | `F01_command_truth_routes` |
| 2 | Open Blackwire room | `GET /rooms/blackwire-ops` | `GET /api/group-chat/rooms?room=blackwire-ops` → 200 JSON | none (read-only) | `F02_blackwire_room_open` |
| 3 | Send/see message with sent/delivered/seen | UI message composer | `POST /api/group-chat/messages` body `{roomSlug:"blackwire-ops",body:"<demo body>",senderType:"human"}` then `PATCH /api/group-chat/delivery` × {sent, delivered, seen} | new row in `group_chat_messages`; ≥3 rows in `group_chat_message_delivery_state` for that message id | `F03_message_states` |
| 4 | Create task from @mention / plain English | UI "@neon-forge close out the false-green QA matrix" | implicit via `POST /api/group-chat/messages` (mention parser inside `createGroupChatMessage`) | new row in `group_chat_assignment_tracker_items` linked to source `message_id` | `F04_assignment_created` |
| 5 | Task appears on Blackwire board + agent sub-board | `GET /rooms/blackwire-ops` (Tracker tab) and `GET /tracker?agent=neon-forge` (or Tracker Board panel filter) | (uses `assignments` from rooms route) | none (read-only) | `F05_assignment_visible` |
| 6 | Approval-needed action blocks and asks Chris | UI: attempt status `done` without evidence | `PATCH /api/group-chat/assignments` body `{assignmentId:<id>, status:"done"}` → expected HTTP 400 `{"error":"Evidence is required before an assignment can move to Done"}` | none (write rejected) | `F06_done_blocked_400` |
| 7 | Chris approves; receipt attaches | UI: receipt composer | `POST /api/group-chat/receipts` body `{roomSlug:"blackwire-ops",sourceMessageId:<msg id>,decision:"<approval text>",approvedBy:"chris",approvalTier:"chris_explicit",evidence:"<link or note>"}` → 201 | new row in `group_chat_decision_receipts`, `approval_tier='chris_explicit'`, `source_message_id` linked | `F07_receipt_created` |
| 8 | Evidence required before Done (positive path) | UI: status `done` with evidence | `PATCH /api/group-chat/assignments` body `{assignmentId:<id>, status:"done", evidence:"receipts/<receipt_id>"}` → 200 | `group_chat_assignment_tracker_items.status='done'`, `evidence` column non-empty | `F08_done_with_evidence` |
| 9 | Agent card shows proof-based status | UI: Agent Registry / Agent Card for `neon-forge` | (uses `agentProfiles` from rooms route or dedicated `/api/agents` view) | none (read-only) — card shows `online_proven=false`, `last_evidence_at=<timestamp>`, no fake-online | `F09_agent_card_proof_status` |
| 10 | Canonical Roots: active MC path + legacy rollback marked | `GET /command-truth?tab=routes` row drilldown for `mission-control` slug | `GET /api/command-truth/routes` (or fallback per §6) | none (read-only) | `F10_canonical_roots` |

**Plain-English translation of each frame is in §8 — give that to Chris when previewing the demo.**

---

## 3. Run-of-show (the actual demo, in execution order)

A demo operator (Koda, or Chris later) should be able to follow this in 5-7 minutes. Numbers correspond to §2.

```
0)  Auth: POST /api/auth/login  →  receive session cookie. Hold cookie for all subsequent requests.
1)  Browse to /command-truth?tab=routes. Capture F01.
2)  Browse to /rooms/blackwire-ops. Capture F02. Confirm rooms=4 / messages=N / queuedAlerts≥1.
3a) Send: POST /api/group-chat/messages — body "Demo run @ <stamp>". Capture message id M1.
3b) Patch delivery to 'sent' for room recipient, 'delivered' for agent recipients, 'seen' for human:chris. Capture F03.
4a) Send: POST /api/group-chat/messages — body "@neon-forge close out the false-green QA matrix" — capture message id M2 and the assignment id A1 returned in the response.
4b) Capture F04 showing the assignment row in DB and in UI tracker.
5)  Browse to tracker view filtered to neon-forge. Capture F05.
6)  Attempt: PATCH /api/group-chat/assignments — body {assignmentId: A1, status: "done"}. Expect 400. Capture response in F06.
7)  POST /api/group-chat/receipts — body { sourceMessageId: M2, decision: "Approved per Chris demo run", approvedBy: "chris", approvalTier: "chris_explicit", evidence: "<demo evidence ref>" }. Capture receipt id R1 in F07.
8)  PATCH /api/group-chat/assignments — body {assignmentId: A1, status: "done", evidence: "receipts/R1"}. Expect 200. Capture F08.
9)  Browse to Agent Registry → neon-forge card. Capture F09 showing proof-based status (no fake-online).
10) Browse back to /command-truth?tab=routes → drill mission-control. Capture F10 showing canonical path = /Users/vortexventures/Desktop/Vortex Ventures/VVMissionControlOps/mission-control AND legacy = /Users/vortexventures/Desktop/Vortex Ventures/VVAxeOps/mission-control marked rollback.

End: pnpm run typecheck. Confirm exit 0.
```

---

## 4. Canonical evidence-receipt schema

This is the single template Koda fills out and Herm signs. File path:

`VVKodaOps/Dispatch_Outbox/<stamp>_KODA_BLACKWIRE_DEMO_RECEIPT.md`

```markdown
# Blackwire Demo Receipt — <stamp> EDT

## Runtime proof
- Listener cwd: <output of `lsof -i :3104` filtered to node, then `pwdx <pid>` or `lsof -p <pid> | grep cwd`>
- typecheck: <`pnpm run typecheck` exit code; PASS / FAIL>
- Auth method: session cookie mc-session / __Host-mc-session
- Demo operator: <name>

## Frame captures (10/10 required)
| Frame | URL/API | HTTP | Body / body excerpt | DB ID(s) | Screenshot path |
|---|---|---|---|---|---|
| F01 | GET /command-truth?tab=routes | 200 | <head excerpt or JSON keys> | n/a | docs/demo-evidence/<stamp>/F01.png |
| F02 | GET /api/group-chat/rooms?room=blackwire-ops | 200 | rooms / selectedRoom / messages / assignments / receipts / queuedAlerts / agentProfiles keys present | rooms=N msgs=N | docs/demo-evidence/<stamp>/F02.png |
| F03 | POST /api/group-chat/messages + 3× PATCH /api/group-chat/delivery | 201, 200×3 | message id, delivery state rows | message_id=<M1> deliveries=≥3 | docs/demo-evidence/<stamp>/F03.png |
| F04 | POST /api/group-chat/messages (@mention) | 201 | mention-parser created assignment | message_id=<M2> assignment_id=<A1> | docs/demo-evidence/<stamp>/F04.png |
| F05 | GET tracker view | 200 | assignment A1 visible filtered to neon-forge | assignment_id=<A1> | docs/demo-evidence/<stamp>/F05.png |
| F06 | PATCH /api/group-chat/assignments {status:done, no evidence} | 400 | "Evidence is required before an assignment can move to Done" | n/a (rejected) | docs/demo-evidence/<stamp>/F06.png |
| F07 | POST /api/group-chat/receipts | 201 | receipt id, approval_tier='chris_explicit' | receipt_id=<R1> | docs/demo-evidence/<stamp>/F07.png |
| F08 | PATCH /api/group-chat/assignments {status:done, evidence:receipts/R1} | 200 | status='done' evidence non-empty | assignment_id=<A1> | docs/demo-evidence/<stamp>/F08.png |
| F09 | Agent Registry → neon-forge card | 200 | online_proven=false, last_evidence_at=<ts> | agent_profile_id=<AP> | docs/demo-evidence/<stamp>/F09.png |
| F10 | /command-truth → routes → mission-control | 200 | canonical = relocated repo; legacy = VVAxeOps/mission-control marked rollback | n/a | docs/demo-evidence/<stamp>/F10.png |

## DB counts after demo
| Table | Before | After |
|---|---|---|
| group_chat_rooms | 4 | <N> |
| group_chat_messages | 5 | <N+2> |
| group_chat_message_delivery_state | 15 | <N+3 minimum> |
| group_chat_assignment_tracker_items | 2 | <N+1> |
| group_chat_decision_receipts | 2 | <N+1> |
| group_chat_agent_profile_cards | 5 | 5 |
| group_chat_queued_alerts | 1 | ≥1 |

## Surfaces shown
- Blackwire Ops room: ✅ visible | ⚪ Not Instrumented Yet
- Assignment Tracker Board: ✅ visible | ⚪ Not Instrumented Yet
- Decision Receipts log: ✅ visible | ⚪ Not Instrumented Yet
- Agent Registry / cards: ✅ visible | ⚪ Not Instrumented Yet
- Command Truth — Routes: ✅ visible | ⚪ Not Instrumented Yet
- Command Truth — Agents: ⚪ Not Instrumented Yet (acceptable for MVP per §5)
- Command Truth — Projects: ⚪ Not Instrumented Yet (acceptable for MVP per §5)
- Command Truth — Memory: ⚪ Not Instrumented Yet (acceptable for MVP — research-gate per Herm contract)
- Metrics Cockpit: ⚪ Not Instrumented Yet (acceptable for MVP)
- Brain / Memory surfaces: ⚪ Not Instrumented Yet — research-gate (acceptable per Herm decision contract)
- Brainstorm Wall / New Project: ⚪ Not Instrumented Yet (acceptable for MVP)
- Asset Library: ⚪ Not Instrumented Yet (acceptable for MVP)
- Mobile responsive shell: ✅ visible | ⚪ Not Instrumented Yet (capture on phone viewport optional v0)

Each surface shows EITHER real data OR the Not-Instrumented-Yet component (§5). No checkbox is "✅" without a captured frame or a DB row reference.

## Port 3000 ownership status (separate track)
- Port 3000 listener PIDs at <stamp>: <list from lsof>
- Decision: Held — not killed in this run.
- Owner needed: Chris approval before takeover.

## Open items
- <list anything not captured + the exact reason>

— Filed by Koda, signed by Herm
```

---

## 5. Not-Instrumented-Yet component spec

**Purpose:** any MC surface that does not yet have a real implementation MUST render this component instead of either (a) a fake/empty panel that looks shipped or (b) a 404. This is the anti-fake-green visual contract.

**Component name:** `NotInstrumentedYet`
**File path (target):** `src/components/common/not-instrumented-yet.tsx`
**Props:**
```ts
type NotInstrumentedYetProps = {
  surface: string;        // e.g. "Metrics Cockpit"
  reason: 'pending_build' | 'research_gate' | 'evidence_missing';
  contractRef?: string;   // path to Herm decision contract that documents the gate
  expectedAt?: string;    // optional human-readable expected date / slice
};
```

**Visual treatment (premium UI, JARVIS-on-acid hero language compatible):**

```
┌──────────────────────────────────────────────────────────────┐
│  ◐  Not Instrumented Yet                                     │
│                                                              │
│  Surface:  {surface}                                         │
│  Reason:   {reason → human label}                            │
│  Gate:     {contractRef ? "see contract" : "no live data"}   │
│                                                              │
│  This panel will render real data once the underlying        │
│  system ships. It is not a stub or a mock — it is the        │
│  honest current state.                                       │
│                                                              │
│  [ View contract → ]  (only if contractRef set)              │
└──────────────────────────────────────────────────────────────┘
```

**Reason → human label map:**
- `pending_build` → "Build pending. Tracked in MVP slice queue."
- `research_gate` → "Research-gated. No real data until research-gate review (per Herm decision contract)."
- `evidence_missing` → "Evidence missing. Showing 'Not Instrumented' instead of fake data."

**SVG mock (drop-in for design preview):**

```svg
<svg viewBox="0 0 720 240" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1020"/>
      <stop offset="1" stop-color="#0f1a30"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="720" height="240" rx="16" fill="url(#bg)" stroke="#22304a" stroke-width="1"/>
  <circle cx="36" cy="36" r="8" fill="#3b82f6" opacity="0.85"/>
  <text x="56" y="42" fill="#cbd5ff" font-family="ui-monospace,Menlo,monospace" font-size="16" font-weight="600">Not Instrumented Yet</text>
  <line x1="24" y1="64" x2="696" y2="64" stroke="#22304a" stroke-width="1"/>
  <text x="24" y="100" fill="#8fa1c7" font-family="ui-monospace" font-size="12">Surface</text>
  <text x="120" y="100" fill="#e6ecff" font-family="ui-monospace" font-size="12">{surface}</text>
  <text x="24" y="124" fill="#8fa1c7" font-family="ui-monospace" font-size="12">Reason</text>
  <text x="120" y="124" fill="#e6ecff" font-family="ui-monospace" font-size="12">{reason label}</text>
  <text x="24" y="148" fill="#8fa1c7" font-family="ui-monospace" font-size="12">Gate</text>
  <text x="120" y="148" fill="#e6ecff" font-family="ui-monospace" font-size="12">{contract ref or "no live data"}</text>
  <text x="24" y="190" fill="#7d8db0" font-family="ui-monospace" font-size="11">This panel will render real data once the underlying system ships.</text>
  <text x="24" y="208" fill="#7d8db0" font-family="ui-monospace" font-size="11">It is not a stub or a mock — it is the honest current state.</text>
</svg>
```

**Where to drop it for MVP acceptability (§4 surfaces table):**

| Surface | Reason | Contract ref |
|---|---|---|
| Command Truth — Agents tab | pending_build | `2026-05-01_AGENT_REGISTRY_CARDS_HERM_DECISION_CONTRACT.md` |
| Command Truth — Projects tab | pending_build | `2026-05-01_PROJECT_ROOMS_STATUS_HERM_DECISION_CONTRACT.md` |
| Command Truth — Memory tab | research_gate | `2026-05-01_MEMORY_LAYER_RESEARCH_GATE.md` |
| Metrics Cockpit | pending_build | `2026-05-01_METRICS_COCKPIT_HERM_DECISION_CONTRACT.md` |
| Brain/Memory surfaces | research_gate | `2026-05-01_MEMORY_BRAIN_SURFACE_HERM_DECISION_CONTRACT.md` |
| Brainstorm Wall / New Project | pending_build | `2026-05-01_NEW_PROJECTS_BRAINSTORM_WALL_REQUIREMENT.md` |
| Asset Library | pending_build | `2026-05-01_ASSET_LIBRARY_NUCLEUS_REQUIREMENT.md` |

**Hard rule:** any of these surfaces rendered as "looks shipped but has no data" or "404" or "TODO" stub ≠ MVP. Either NotInstrumentedYet, or a real implementation. Nothing in between.

---

## 6. Fallback if Command Truth route doesn't exist

The Build Bible references a `/command-truth` page with four tabs (routes, agents, projects, memory). If that route is not yet wired in the canonical repo, the demo can still run with a documented fallback:

| Original target | Fallback for v0 demo | NotInstrumentedYet flag |
|---|---|---|
| `/command-truth?tab=routes` | render NotInstrumentedYet with embedded "active runtime: 3104; legacy: VVAxeOps/mission-control" facts read from a static contract file | `evidence_missing` |
| `/command-truth?tab=agents` | NotInstrumentedYet | `pending_build` |
| `/command-truth?tab=projects` | NotInstrumentedYet | `pending_build` |
| `/command-truth?tab=memory` | NotInstrumentedYet | `research_gate` |

The fallback is acceptable for the demo IF F01 and F10 frames in §2 still capture either (a) the real route OR (b) the NotInstrumentedYet component with the contract reference shown. Treating the empty state as honest = passes anti-fake-green.

---

## 7. False-green checklist (Neon Forge / Axis target)

Each of these is a thing Neon Forge MUST try to break. PASS = the demo holds. FAIL = the demo is not proven and Patch/Koda must fix before Herm signs off.

1. **Fake online state.** Browse to neon-forge agent card. Confirm `online_proven` is computed from real evidence (recent receipt, recent message, recent task transition), not from a heartbeat-only signal. If only a heartbeat shows online, the card MUST say "online_proven=false."
2. **Fake delivery states.** Inspect `group_chat_message_delivery_state` rows tied to demo message M1. Each row MUST be tied to a real recipient_id (not `'unknown'`, not the sender). Orphan rows = fail.
3. **Fake @mention task.** The assignment row created at step 4 MUST have `source_message_id` linked to message M2; assignee MUST be `neon-forge`; status MUST be `created` (not pre-set to `working` or `done`).
4. **Fake decision receipt.** Receipt R1 MUST be linkable from message M2 AND from assignment A1's evidence path. Search/find by message id MUST surface it.
5. **Done-without-evidence bypass.** Try every path: (a) PATCH with status=done and empty evidence string; (b) PATCH with status=done and `evidence: null`; (c) PATCH with status=done and `evidence: "  "` (whitespace). All three MUST return HTTP 400. Any 200 = fail.
6. **Legacy-runtime spoof.** Confirm port 3104's listener cwd = canonical relocated repo via `lsof -p <pid> | grep cwd`. If the cwd resolves to `VVAxeOps/mission-control` or `Projects/telegram-claude-bot`, ALL ten frames are invalid.
7. **Empty-state fakery.** For every surface in §5 table, confirm rendering is either real or NotInstrumentedYet. Find any panel that renders "looks shipped but blank" = fail.
8. **Mobile/responsive break.** Open `/rooms/blackwire-ops` on a 390px viewport. Confirm room list, message thread, and tracker are usable (scroll, send, see). If unreadable = fail.
9. **Typecheck regression.** `pnpm run typecheck` MUST PASS at the moment Neon Forge runs the matrix. Any new error introduced by the demo capture = fail.
10. **Receipt template completeness.** Every cell in §4's frame table populated. Any "<…>" placeholder remaining = fail.

Neon Forge files closeout at `VVAxeOps/Dispatch_Outbox/<stamp>_NEON_FORGE_BLACKWIRE_FALSE_GREEN_RECEIPT.md` with PASS/FAIL/BLOCKED per row + exact evidence path.

---

## 8. Plain-English captions for Chris

When Chris wants to preview the demo without reading API jargon, use these captions in the receipt and any deck/screenshot annotation.

| Frame | Plain-English caption |
|---|---|
| F01 | "Command Truth, Routes tab — single source of truth for which Mission Control path is active and which is rollback." |
| F02 | "Blackwire Ops room — your live command room for this project." |
| F03 | "Sent. Delivered. Seen. Real states from the database, not a fake checkmark." |
| F04 | "@neon-forge mention auto-created an Assignment Tracker card. No manual ticket-filing." |
| F05 | "Same card visible on Blackwire Ops board AND on neon-forge's agent sub-board. One source." |
| F06 | "Done blocked: no evidence attached. Mission Control says no." |
| F07 | "Decision receipt filed. Tied to the original message and to the task." |
| F08 | "Done allowed: evidence is the receipt itself. Audit trail closed." |
| F09 | "Agent card shows proof-based status — last real activity, not a heartbeat ping." |
| F10 | "Canonical Roots: the active Mission Control path is the relocated repo. The old VVAxeOps copy is marked rollback." |

---

## 9. Sign-off matrix

The demo is "proven end-to-end" when ALL of the following are true:

- [ ] §4 receipt filed by Koda with all 10 frames captured (no "<…>" left)
- [ ] §7 false-green matrix filed by Neon Forge with no FAIL rows
- [ ] §1 typecheck PASS captured at receipt-file time
- [ ] §1 lsof cwd = canonical relocated repo at receipt-file time
- [ ] No surface in §5 rendered as fake-shipped or 404; all are real or NotInstrumentedYet
- [ ] Herm reads §4 receipt + §7 matrix and signs at `VVHermsOps/Dispatch_Outbox/<stamp>_HERM_BLACKWIRE_DEMO_SIGNOFF.md`

Until all six boxes are checked, the demo is not "done." This is the explicit anti-fake-green gate.

---

## 10. Patch lane note

This document is design / product / scope coherence only. Patch does not own:
- the implementation of any panel or API
- the system-truth contract for "online_proven" semantics (Herm)
- killing port-3000 listeners (Chris approval / Herm execute)
- David / Material Solutions memory (out of MC scope per Build Bible)
- the runtime decision to move user-facing routing from 3000 to 3104 (Herm + Chris)

Patch will iterate this runbook if Herm or Koda flag a step that's wrong, ambiguous, or scope-creeping. Iteration goes in this same file with a dated entry at the bottom.

— Patch, 2026-05-02 09:30 EDT
