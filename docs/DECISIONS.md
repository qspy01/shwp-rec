# Architectural Decisions — shwp-rec VOD Platform

> This file is a running log of significant architectural decisions.
> For major decisions, a full ADR exists in `docs/adr/`.
> Last updated: 2026-05-16

---

## Decision Log

### 2026-05-16 — Modular monolith, not microservices

**Decision:** Build as a modular monolith (Turborepo workspace, single Docker Compose,
shared Postgres, shared Redis) rather than microservices.

**Rationale:** Operational complexity of microservices is not justified at this scale.
The team is small. Shared database simplifies transactions. Modules can be extracted later
if a specific component needs independent scaling.

**What this means:**
- One Postgres instance, multiple schemas/tables per domain
- One Redis instance, namespaced keys per module
- All apps deployed via a single Docker Compose
- Module boundaries enforced by code, not by network

See: `docs/adr/ADR-001-monorepo-foundation.md`

---

### 2026-05-16 — NestJS for API, not Express

**Decision:** Use NestJS (not bare Express) for `apps/api`.

**Rationale:** NestJS provides built-in DI, module system, decorators for guards/pipes,
and OpenAPI generation. This enforces the module boundaries we need and reduces boilerplate.
The existing `cyber-cygan` project uses Express with manual DI — we've observed that leads
to fragmented Redis clients, duplicate PrismaClient instances, and scattered middleware.
NestJS's module system prevents this by design.

**Tradeoff:** Steeper initial learning curve. More boilerplate per module. Worth it for
the structural enforcement.

---

### 2026-05-16 — Recorder does NOT write to DB directly

**Decision:** `apps/recorder` communicates with `apps/api` via HTTP (HMAC-signed), never
touches the database directly.

**Rationale:**
- Clean separation of concerns (recorder = capture, API = platform)
- Easier to scale, replace, or restart recorder without DB migrations
- Ingest becomes a formal API contract, not an implementation detail
- Recorder can run on a different machine if needed

**Tradeoff:** Extra HTTP hop per event. Acceptable latency for this use case.

---

### 2026-05-16 — BullMQ for job queue, not Kafka or SQS

**Decision:** Use BullMQ (backed by Redis) for processing job queue.

**Rationale:** BullMQ provides all required features (persistence, retry, concurrency limits,
delayed jobs, job events) without operational complexity of Kafka. Already have Redis in the
stack. Can be monitored via Bull Board. Kafka would be overkill for current throughput.

**Tradeoff:** BullMQ is tied to Redis. If Redis fails, queue pauses (not fails permanently).
Acceptable for this use case.

---

### 2026-05-16 — Cloudflare R2 for object storage, not S3

**Decision:** Use Cloudflare R2 as primary object storage.

**Rationale:**
- Zero egress cost (critical for video streaming)
- S3-compatible API (use AWS SDK v3 with custom endpoint)
- Integrates with Cloudflare CDN natively
- `.env.example` already references R2

**Tradeoff:** Tied to Cloudflare. Acceptable given we're already using Cloudflare CDN.
Storage abstraction (`packages/storage`) allows swapping providers later.

---

### 2026-05-16 — HLS for video delivery, not DASH or progressive MP4

**Decision:** Encode and deliver video as HLS (`.m3u8` + `.ts` segments).

**Rationale:**
- Universal browser support via `hls.js`
- Native support on iOS/Safari
- Adaptive bitrate switching built into the format
- Segments can be cached individually on CDN
- fMP4 segments from recorder are already compatible with HLS

**Tradeoff:** Slightly more complex processing pipeline than progressive MP4. Worth it for
CDN efficiency and ABR support.

---

### 2026-05-16 — Prisma as ORM, PostgreSQL as database

**Decision:** Use Prisma with PostgreSQL.

**Rationale:**
- Type-safe queries, schema-as-code
- Migration tooling built-in
- Already in `.env.example`
- Team familiarity

**Tradeoff:** Prisma does not support all PostgreSQL features (e.g., complex CTEs are
harder). Raw queries available via `prisma.$queryRaw` when needed.

---

### 2026-05-16 — Keep Playwright stealth for recording

**Decision:** Keep Playwright + stealth plugin as the recording mechanism.

**Rationale:** The Storm WebSocket stream URL requires a session cookie that is only
obtainable by loading the showup.tv page. Bot detection prevents headless browsing
without stealth. The current approach works.

**Future consideration:** If showup.tv exposes an authenticated HLS/RTMP endpoint,
direct FFmpeg capture would be preferable (no browser needed). Investigate when time
allows.

---

### 2026-05-16 — No public upload endpoints

**Decision:** There are NO public endpoints for users to upload videos. Ingest is
internal-only, performed by `apps/recorder` with HMAC authentication.

**Rationale:** Platform is a legal VOD archive, not a user-generated content platform.
Content is created automatically from live recordings. Allowing user uploads would
require content moderation, virus scanning, rights management, and abuse prevention.
Out of scope.

---

### 2026-05-16 — Billing-ready, not billing-complete

**Decision:** Schema and module boundaries are designed to support billing/subscriptions,
but no payment provider (Stripe) is integrated yet.

**What is done now:**
- `Plan` model in Prisma (defines content access tiers)
- `Entitlement` model (feature flags per user)
- `role` field on User (USER, ADMIN)
- Video `visibility` field (PUBLIC, PRIVATE, SUBSCRIBERS_ONLY)

**What is NOT done:**
- No Stripe integration
- No payment flows
- No subscription lifecycle management
- No billing events

---

### 2026-05-16 — Local files are temporary only

**Decision:** The local filesystem is NEVER a reliable source of truth. All important
state must exist in: database (recording metadata), R2 (media files), Redis (queues).

**Rationale:** Disk can fill, crash, or be wiped. Files on disk without a DB record are
orphans. The system must be able to reconstruct its state from DB + R2 without touching
the local filesystem.

**Implications:**
- Recorder uploads to R2 immediately (streaming multipart upload)
- Worker downloads from R2, processes, uploads back to R2
- Local temp files are cleaned up after each job
- Orphan detection runs as a scheduled cleanup job
