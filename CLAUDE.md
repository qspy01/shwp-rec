You are a Staff+ production software engineer.

Your task is to transform this repository into a scalable legal VOD platform.

Core assumptions:
- recordings are automatic
- no manual uploads
- ingestion is internal-only
- billing not implemented yet
- architecture must remain billing-ready

Critical philosophy:
- modular monolith first
- avoid enterprise overengineering
- build for production stability
- prefer simplicity over complexity

# CyberCygan — Transformation Roadmap

---

# PHASE 1 — Architecture Audit

## Status

IN PROGRESS

## Tasks

- [x] analyze repository structure
- [x] identify backend entrypoints
- [x] identify frontend architecture
- [x] identify streaming lifecycle
- [x] identify persistence layers
- [x] identify coupling risks
- [x] identify scalability risks
- [x] define target architecture
- [x] define admin architecture direction

---

# PHASE 2 — Monorepo Foundation

## Priority

CRITICAL

## Tasks

- [ ] normalize apps/ structure
- [ ] normalize packages/ structure
- [ ] introduce strict TS configs
- [ ] create shared types package
- [ ] create shared config package
- [ ] create storage abstraction package
- [ ] formalize environment validation
- [ ] introduce API versioning (/api/v1)
- [ ] create admin module boundaries
- [ ] create worker application boundary
- [ ] setup Docker Compose foundation

---

# PHASE 3 — Admin Backend Core

## Tasks

- [ ] create admin API namespace
- [ ] implement admin RBAC middleware
- [ ] implement audit logging
- [ ] implement admin session management
- [ ] implement user moderation actions
- [ ] implement quota management
- [ ] implement plan management
- [ ] implement activity inspection APIs
- [ ] implement operational metrics APIs

---

# PHASE 4 — Admin Frontend

## Tasks

- [ ] create dedicated admin layout
- [ ] create admin navigation system
- [ ] create admin dashboard
- [ ] create users management UI
- [ ] create plans management UI
- [ ] create quotas management UI
- [ ] create sessions viewer
- [ ] create activity explorer
- [ ] create audit logs UI
- [ ] create operational monitoring UI
- [ ] create responsive mobile admin UI

---

# PHASE 5 — Recorder Isolation

## Tasks

- [ ] isolate recorder runtime
- [ ] remove direct DB coupling
- [ ] introduce signed ingest requests
- [ ] implement retry-safe uploads
- [ ] implement ingest event reporting
- [ ] implement ingest crash recovery

---

# PHASE 6 — Processing Pipeline

## Tasks

- [ ] introduce BullMQ
- [ ] create worker runtime
- [ ] implement queue persistence
- [ ] implement FFmpeg concurrency limits
- [ ] implement processing retries
- [ ] implement timeout handling
- [ ] implement HLS generation
- [ ] implement thumbnails generation
- [ ] implement cleanup jobs

---

# PHASE 7 — Storage Layer

## Tasks

- [ ] implement storage abstraction
- [ ] implement R2 provider
- [ ] implement signed URLs
- [ ] implement multipart uploads
- [ ] implement retention policies
- [ ] implement orphan cleanup jobs

---

# PHASE 8 — Observability

## Tasks

- [ ] structured logging
- [ ] correlation IDs
- [ ] Prometheus metrics
- [ ] Grafana dashboards
- [ ] Sentry integration
- [ ] queue monitoring
- [ ] worker monitoring
- [ ] API latency monitoring

---

# PHASE 9 — Billing Ready Architecture

## Tasks

- [ ] entitlement models
- [ ] feature flags
- [ ] subscription boundaries
- [ ] access policy system
- [ ] billing event interfaces

NOTE:
No Stripe implementation yet.

---

# PHASE 10 — QA & Stabilization

## Tasks

- [ ] unit tests
- [ ] integration tests
- [ ] E2E tests
- [ ] queue failure testing
- [ ] worker crash recovery testing
- [ ] storage outage testing
- [ ] malformed media testing
- [ ] performance testing
- [ ] security review

Critical rules:
- do not rewrite unrelated code
- do not silently break APIs
- do not duplicate domain models
- do not hardcode providers
- do not tightly couple storage
- do not block APIs with FFmpeg

Architecture rules:
- Separate recorder from public platform
- Never tightly couple storage with business logic
- Never couple video processing with frontend
- Prefer modular monolith architecture
- Prefer explicit interfaces
- Prefer composition over inheritance
- Avoid hidden magic
- Avoid premature abstractions
- Avoid enterprise overengineering

Do NOT introduce unless clearly justified:
- Kubernetes
- Kafka
- CQRS
- Event sourcing
- Distributed transactions
- Service mesh
- Elasticsearch
- GraphQL federation
- Multi-region replication
- DRM systems

Single source of truth rules:
- Prisma schema is the source of truth for persistence
- OpenAPI contracts are the source of truth for APIs
- Shared package types are the source of truth for frontend/backend contracts
- Never redefine domain models across services
- Never duplicate DTOs unnecessarily

AI agents MUST maintain:
docs/
  ARCHITECTURE.md
  CURRENT_STATE.md
  KNOWN_ISSUES.md
  DECISIONS.md
  TODO.md

Rules:
- update after major changes
- summarize architectural decisions
- track known technical debt
- preserve context between sessions

For every major architectural decision:
Create/update ADR documents in:

docs/adr/

Each ADR must include:
- context
- decision
- alternatives considered
- tradeoffs
- future implications

Domain model rules:
Video = logical content entity
Source = original ingest
Asset = physical media object
Variant = encoded version
Playlist = HLS manifest
Segment = HLS chunk
Thumbnail = generated preview image

Storage rules:
Local filesystem is NOT a reliable source of truth.

All important state must exist in:
- database
- object storage
- persistent queues

Local files are temporary only.

Storage cost protection:
Storage optimization is critical.

Implement:
- retention policies
- lifecycle cleanup
- orphan detection
- duplicate detection
- RAW cleanup jobs
- archival workflows

Never store unnecessary RAW files forever.

Video processing safety rules:
- limit concurrent FFmpeg processes
- enforce memory limits
- enforce timeout limits
- validate media before processing
- reject malformed files safely
- prevent worker exhaustion
- all jobs must be retry-safe
- all jobs must be idempotent



Required observability:
- structured logs
- correlation IDs
- tracing IDs
- retry counts
- processing durations
- queue metrics
- failure reasons
- health checks

API rules:
- version APIs from day one
- use /api/v1
- never silently break contracts
- use DTO validation everywhere
- return structured errors

Internal ingest security:
- recorder authenticates using service credentials
- internal ingest endpoints are isolated
- no public ingest endpoints
- signed requests preferred
- ingest actions audited

Frontend performance rules:
Frontend requirements:
- route-level code splitting
- optimized video loading
- minimize hydration
- use server components where possible
- optimize Core Web Vitals
- responsive design mandatory
- accessibility matters

Pull request quality gates:
- lint must pass
- typecheck must pass
- tests must pass
- build must pass
- no TODO placeholders
- no debug console spam

When context grows:
- summarize progress
- update project memory files
- preserve architectural decisions

TARGET TECH STACK:
Frontend - Next.js
Backend - NestJS
ORM - Prisma
Database - PostgreSQL
Queue - BullMQ
Cache - Redis
Video - FFmpeg
Storage - Cloudflare R2
CDN - Cloudflare
Infra - Docker
Monitoring - Grafana + Prometheus
Error Tracking - Sentry
