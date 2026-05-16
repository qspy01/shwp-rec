# ADR-001: Modular Monorepo Foundation

**Date:** 2026-05-16
**Status:** Accepted
**Deciders:** Architecture Audit (Phase 1)

---

## Context

The existing `shwp-rec` codebase is a two-file Node.js recorder with no structure:
- `main.js` — 400-line recorder
- `convert.js` — 200-line FFmpeg converter

The target system is a VOD platform with multiple components:
- Recorder (Playwright + WS capture)
- API (auth, catalog, ingest, admin)
- Frontend (video playback, user auth)
- Worker (FFmpeg, HLS, thumbnails)

We need to decide how to structure this multi-component system from the beginning.

---

## Decision

Build as a **modular monolith using Turborepo pnpm workspaces**.

Structure:
```
apps/
  api/        ← NestJS
  frontend/   ← Next.js
  recorder/   ← Playwright recorder
  worker/     ← BullMQ worker

packages/
  shared/     ← Types, domain constants
  config/     ← Env validation
  storage/    ← Storage abstraction
  auth/       ← JWT/HMAC utilities
  types/      ← API contracts
```

Single PostgreSQL instance. Single Redis instance. Single Docker Compose.

Module communication:
- recorder → api: HTTP (HMAC-signed)
- api → worker: BullMQ (via shared Redis)
- frontend → api: HTTP (JWT-auth)

No direct cross-module database access.

---

## Alternatives Considered

### Option 1: Single Express/NestJS monolith (everything in one app)

- Pros: Simplest. No workspace complexity.
- Cons: Recorder and API share process. Recorder crash takes down API. Cannot deploy
  independently. Cannot scale worker separately. No clear module boundaries.
- **Rejected:** Coupling recorder to API is a known risk pattern for this use case.

### Option 2: Microservices from day one

- Pros: Perfect isolation. Each service deploys independently. Scales individually.
- Cons: Massive operational complexity. Need service discovery, distributed tracing,
  network policies, separate CI pipelines. Overkill for small team/early stage.
  Distributed transactions make the processing pipeline much harder.
- **Rejected:** Violates "modular monolith first" principle from CLAUDE.md.

### Option 3: Keep as two scripts, add more scripts

- Pros: Zero refactoring cost now.
- Cons: Adds technical debt exponentially. Cannot add auth, API, or frontend without
  a proper foundation. The "we'll refactor later" path that never happens.
- **Rejected:** Not a serious path for a production platform.

---

## Rationale

Turborepo already exists in the repo (`turbo.json`, `package.json` with workspaces).
The `.env.example` already defines PostgreSQL, Redis, and R2 — confirming the intended
infrastructure. The scaffold is already started; we are continuing an established direction.

The modular monolith approach gives us:
1. **Clear module boundaries** — no accidental cross-cutting
2. **Shared types** — `packages/types` is the single source of truth for API contracts
3. **Shared utilities** — `packages/storage`, `packages/auth` prevent duplication
4. **Independent deployment** — each `apps/*` becomes a Docker container
5. **Path to microservices** — if any component needs independent scaling later, it's
   already isolated and can be extracted without changing business logic

---

## Tradeoffs

| Benefit | Cost |
|---|---|
| Module isolation | Workspace setup complexity upfront |
| Shared types | Must publish/build packages before consuming apps |
| Single DB | No independent DB scaling per module |
| Single Redis | No independent Redis scaling per module |
| Docker Compose simplicity | Not production-grade orchestration (Kubernetes later) |

The single DB/Redis tradeoff is acceptable for the current scale. Turborepo build caching
mitigates the package build cost.

---

## Future Implications

1. If the recorder needs to run on a different physical machine, it communicates via HTTP
   to the API — this is already the design. No changes needed.

2. If the worker needs to scale horizontally, multiple instances of `apps/worker` can run
   against the same BullMQ Redis. BullMQ handles this natively.

3. If PostgreSQL needs to scale, Prisma supports read replicas. The API can be updated
   to route read queries to replicas without changing business logic.

4. If we ever need to extract a microservice (e.g., the video processing pipeline), the
   module boundary is already clean: worker only communicates via BullMQ and reads/writes
   to DB via its own Prisma client. Extracting it means changing the BullMQ transport from
   Redis to a managed queue service.
