# Phase 1 — Architecture Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 1 Architecture Audit — explore the `shwp-rec` codebase and produce four foundational docs that anchor all future implementation phases.

**Architecture:** This is a documentation-first phase. No code changes. Deliverables are markdown files that capture current state, propose target architecture, record decisions, and define a phased TODO list.

**Tech Stack:** N/A — pure documentation phase.

---

## Status

- [x] Codebase exploration
- [x] Entrypoint analysis
- [x] Recording lifecycle mapping
- [x] WebSocket flow identification
- [x] Filesystem dependency mapping
- [x] Coupling risk identification
- [x] Scalability risk identification
- [x] Target architecture proposal
- [x] Create docs/ARCHITECTURE.md
- [x] Create docs/CURRENT_STATE.md
- [x] Create docs/DECISIONS.md
- [x] Create docs/TODO.md
- [x] Create docs/adr/ADR-001-monorepo-foundation.md
- [x] Commit phase 1 docs

---

### Task 1: Explore and analyze repository

**Files read:**
- `main.js` — recorder entry point
- `convert.js` — FFmpeg converter
- `package.json` — monorepo root
- `turbo.json` — turborepo config
- `config.yml` — recorder config
- `.env.example` — infrastructure requirements
- `packages/shared/package.json` — shared package stub
- `CLAUDE.md` — roadmap and rules

**Findings:**
- Single-file recorder intercepting showup.tv WebSocket binary frames
- No database, no API, no cloud storage
- In-memory state only (crash = data loss)
- Turborepo scaffold exists but apps/ is empty
- .env.example already references target infra (PG, Redis, R2)

- [x] Exploration complete

---

### Task 2: Create documentation files

- [x] docs/ARCHITECTURE.md — target architecture, domain model, component map
- [x] docs/CURRENT_STATE.md — current codebase analysis, risks, limitations
- [x] docs/DECISIONS.md — architectural decisions log
- [x] docs/TODO.md — phased implementation roadmap
- [x] docs/adr/ADR-001-monorepo-foundation.md — decision record for monorepo approach

---

### Task 3: Commit

- [ ] `git add docs/`
- [ ] `git commit -m "docs: Phase 1 Architecture Audit complete"`
