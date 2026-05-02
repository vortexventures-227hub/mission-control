# Mission Control — Roadmap
**Last Updated:** 2026-03-31 21:40 EDT
**Author:** Axis (Axe)

---

## Overview

Mission Control is Vortex Ventures' AI agent orchestration dashboard.
- Built on open-source Mission Control by Builderz Labs
- Manages agent fleets, tracks tasks, monitors costs
- Vortex's instance: http://localhost:3000

---

## Features

- 32 panels: Tasks, agents, skills, logs, tokens, memory, security, cron, alerts, pipelines
- Real-time WebSocket updates
- SQLite database (no external dependencies)
- Role-based access (viewer, operator, admin)
- Built-in Aegis review system
- Recurring tasks with cron scheduling
- Claude Code bridge
- Skills Hub
- Multi-gateway support

---

## Current Status

| Component | Status |
|-----------|--------|
| Dashboard | ✅ Running at localhost:3000 |
| Agent Fleet | ✅ Managing Vortex agents |
| Security | ✅ Knox monitoring |
| Cron Jobs | ✅ All scheduled |
| Token Tracking | ✅ Active |

---

## Vortex-Specific Setup

- **Dashboard:** http://localhost:3000
- **Agents connected:** Cipher, Stark, Oompa suite, Scout, Mr. Blanc, Ledger, Scribe, Knox
- **Cron jobs active:** 7 scheduled jobs
- **Security audit:** Knox monitoring 2x daily

---

## Known Issues

- None currently

---

*This roadmap is the single source of truth for Mission Control. Updated every time status changes.*
