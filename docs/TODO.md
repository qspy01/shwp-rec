# TODO — shwp-rec VOD Platform

> Phased implementation roadmap.
> Update status as phases complete.
> Last updated: 2026-05-16

---

## Phase 1 — Architecture Audit ✅ COMPLETE

**Deliverables:**
- [x] Explore repository structure
- [x] Identify all entrypoints
- [x] Map recording lifecycle
- [x] Identify WebSocket/video handling
- [x] Identify filesystem dependencies
- [x] Identify dangerous coupling
- [x] Identify scalability issues
- [x] Propose modular monolith target architecture
- [x] Create docs/ARCHITECTURE.md
- [x] Create docs/CURRENT_STATE.md
- [x] Create docs/DECISIONS.md
- [x] Create docs/TODO.md
- [x] Create docs/adr/ADR-001-monorepo-foundation.md

---

## Phase 2 — Monorepo Foundation 🔲 PENDING

**Priority:** CRITICAL — all other phases depend on this.

**Goal:** Scaffold the target workspace structure with real apps and packages.

- [ ] Create `apps/api/` — NestJS skeleton (empty, buildable)
- [ ] Create `apps/frontend/` — Next.js skeleton (empty, buildable)
- [ ] Create `apps/recorder/` — Move/refactor `main.js` into isolated app
- [ ] Create `apps/worker/` — BullMQ worker skeleton (empty, buildable)
- [ ] Create `packages/config/` — Zod env validation, shared config schema
- [ ] Create `packages/types/` — API request/response types (source of truth)
- [ ] Populate `packages/shared/` — Domain types, enums, constants
- [ ] Create `packages/storage/` — Storage interface + R2 provider stub
- [ ] Create `packages/auth/` — JWT utilities, HMAC helpers
- [ ] Add strict `tsconfig.json` per app and package
- [ ] Wire up Turborepo `dev`, `build`, `test`, `lint`, `typecheck` tasks
- [ ] Create `infra/docker/` — Dockerfiles per app
- [ ] Create `infra/nginx/` — Nginx proxy config
- [ ] Create `docker-compose.yml` — Full dev environment
- [ ] Document: update ARCHITECTURE.md with actual file paths once scaffolded

**Acceptance criteria:**
- `pnpm install` succeeds
- `pnpm build` compiles all packages
- `pnpm typecheck` passes with zero errors
- `docker compose up` starts postgres, redis, and placeholders

---

## Phase 3 — Backend Core 🔲 PENDING

**Goal:** Implement NestJS API with auth, RBAC, video catalog, and ingest endpoint.

- [ ] Initialize NestJS project in `apps/api/`
- [ ] Initialize Prisma with PostgreSQL
- [ ] Write Prisma schema (User, Video, Source, Asset, Variant, Playlist, ProcessingJob, Plan, Entitlement)
- [ ] Run first migration
- [ ] Implement `AuthModule` — JWT access+refresh, register, login, logout
- [ ] Implement `UsersModule` — profile, watch history, favorites
- [ ] Implement `VideosModule` — list, detail, search (public endpoints)
- [ ] Implement `IngestModule` — HMAC-authenticated recording creation/completion
- [ ] Implement `AdminModule` — user management, moderation, audit log
- [ ] Implement `HealthModule` — /health, /metrics (Prometheus)
- [ ] Add DTO validation (class-validator) on all endpoints
- [ ] Add structured logging (pino)
- [ ] Add correlation ID middleware
- [ ] Write integration tests for auth flow
- [ ] Write integration tests for ingest flow
- [ ] Document: OpenAPI spec (auto-generated via NestJS Swagger)

**API versioning:** All routes under `/api/v1`

**Acceptance criteria:**
- All routes return 400 for invalid input
- HMAC ingest rejects invalid signatures
- JWT auth rejects expired tokens
- `/health` returns 200 with DB + Redis status
- All tests pass

---

## Phase 4 — Recorder Refactor 🔲 PENDING

**Goal:** Isolate recorder into `apps/recorder`, remove filesystem coupling, add ingest reporting.

- [ ] Move `main.js` to `apps/recorder/src/recorder.ts` (TypeScript)
- [ ] Replace in-memory `captures[]` with DB-backed recording state (via API)
- [ ] Implement HMAC-signed requests to API (`packages/auth`)
- [ ] Implement streaming multipart upload to R2 (`packages/storage`)
- [ ] Report recording start to API: `POST /api/v1/ingest/recordings`
- [ ] Report recording end to API: `POST /api/v1/ingest/recordings/:id/complete`
- [ ] Implement crash recovery: on startup, check API for interrupted recordings
- [ ] Handle SIGTERM gracefully (not just SIGINT)
- [ ] Add structured logs (pino) with correlationId per recording session
- [ ] Write unit tests for key functions (WebSocket frame handling, filename generation)

**What does NOT change:**
- Playwright + stealth approach (keep as-is)
- Storm WS interception logic (keep as-is)
- App WS listener logic (keep as-is)

**Acceptance criteria:**
- Process crash mid-recording → restart → recording state recovered from API
- All files go to R2, not local disk
- API receives signed recording events with correct status transitions
- SIGTERM causes clean finalization of all active recordings

---

## Phase 5 — Storage Layer 🔲 PENDING

**Goal:** Implement `packages/storage` with R2 provider and multipart upload support.

- [ ] Define `StorageProvider` interface (TypeScript)
- [ ] Implement `R2Provider` using `@aws-sdk/client-s3` with Cloudflare R2 endpoint
- [ ] Implement `LocalProvider` (dev fallback — writes to local disk)
- [ ] Provider selected via `STORAGE_PROVIDER=r2|local` env var
- [ ] Implement `signedUrl(key, expiresIn)` — S3 presigned URLs
- [ ] Implement multipart: `init`, `uploadPart`, `complete`, `abort`
- [ ] Add retry logic (3 attempts, exponential backoff) on transient S3 errors
- [ ] Write tests with mocked S3 client
- [ ] Implement retention policy helpers (list objects older than N days)
- [ ] Implement orphan detection (assets in R2 not referenced in DB)
- [ ] Document: R2 bucket path conventions

**Bucket path conventions:**
```
raw/{modelName}/{YYYY}/{MM}/{DD}/{recordingId}.mp4
videos/{videoId}/variants/{resolution}/{filename}.m3u8
videos/{videoId}/variants/{resolution}/segments/{n}.ts
videos/{videoId}/thumbnails/{n}.jpg
```

**Acceptance criteria:**
- Unit tests pass with mocked S3
- Integration test: upload file, download file, delete file (against dev R2 bucket)
- Signed URLs expire correctly

---

## Phase 6 — Video Processing Pipeline 🔲 PENDING

**Goal:** Implement `apps/worker` with BullMQ consumers for FFmpeg transcoding, HLS generation, thumbnails.

- [ ] Initialize BullMQ in `apps/worker`
- [ ] Define queue names and job types in `packages/shared`
- [ ] Implement `validate` job — ffprobe validation, reject malformed files
- [ ] Implement `transcode` job — ffmpeg: 3 quality variants (1080p, 720p, 360p)
- [ ] Implement `segment` job — ffmpeg: HLS segmentation per variant, generate .m3u8
- [ ] Implement `upload` job — push segments + manifests to R2
- [ ] Implement `publish` job — update Video.status = PUBLISHED in DB
- [ ] Implement `cleanup` job — delete raw asset from R2 (configurable retention)
- [ ] Implement `thumbnail` job — extract keyframes as JPEG thumbnails
- [ ] Enforce FFmpeg concurrency limit (max 2 concurrent transcode jobs)
- [ ] Enforce timeout per job (transcode: 30min, segment: 10min)
- [ ] Retry failed jobs (max 5 attempts, exponential backoff)
- [ ] All jobs must be idempotent (safe to retry)
- [ ] Add job event logging with correlationId
- [ ] Add Prometheus metrics: job duration, queue depth, failure rate
- [ ] Install Bull Board UI at `/admin/queues`
- [ ] Write unit tests for each job handler
- [ ] Write integration test: full pipeline on test video file

**FFmpeg constraints:**
- Max 2 concurrent transcode processes
- Timeout: 30 minutes per transcode
- Memory limit: 1GB per ffmpeg process (via `ulimit` or docker resource limit)
- Validate media BEFORE starting transcode
- Reject files: duration 0, no video stream, corrupted header

**Acceptance criteria:**
- Valid .mp4 → published HLS in R2 with all variants
- Invalid file → job fails cleanly with error message, no orphan files
- Killed worker → on restart, picks up where it left off (BullMQ persistence)
- All metrics visible in Prometheus

---

## Phase 7 — Public Frontend 🔲 PENDING

**Goal:** Implement Next.js VOD frontend with video catalog, playback, and auth.

- [ ] Initialize Next.js 14+ with App Router in `apps/frontend/`
- [ ] Setup Tailwind CSS + shadcn/ui
- [ ] Implement homepage — featured videos, categories grid
- [ ] Implement video detail page — HLS player (hls.js), metadata, related videos
- [ ] Implement category browse page
- [ ] Implement search results page (server-side, debounced)
- [ ] Implement auth: login, register, email verify flow
- [ ] Implement user profile — watch history, favorites
- [ ] Implement video player with adaptive bitrate selection
- [ ] Implement responsive layout (mobile, tablet, desktop)
- [ ] Implement route-level code splitting
- [ ] Implement server components for catalog pages (reduce JS bundle)
- [ ] Add loading skeletons for video cards and player
- [ ] Optimize Core Web Vitals (LCP, CLS, FID targets)
- [ ] Add accessibility (ARIA labels, keyboard navigation for player)
- [ ] Write E2E tests (Playwright) for: browse, play, auth flow
- [ ] NO upload UI — ever

**No user upload UI. No admin panel in this app (admin is separate).**

**Acceptance criteria:**
- Homepage loads in < 2s on 3G emulation
- HLS player starts in < 1s on fast connection
- All routes are accessible (axe-core scan passes)
- Auth flow works end-to-end (register → login → profile)
- Video plays correctly from R2 via CDN

---

## Phase 8 — Security + DevOps 🔲 PENDING

**Goal:** Harden security, set up monitoring, finalize Docker setup.

- [ ] Finalize Dockerfiles (multi-stage, non-root user, minimal images)
- [ ] Finalize `docker-compose.yml` (resource limits, restart policies, health checks)
- [ ] Finalize Nginx config (rate limiting, security headers, TLS config)
- [ ] Setup Prometheus + Grafana (Docker services)
- [ ] Create Grafana dashboards: API latency, queue depth, error rate, recording count
- [ ] Integrate Sentry (all apps) with release tracking
- [ ] Implement rate limiting on public API endpoints
- [ ] Implement IP-based abuse protection
- [ ] Implement input sanitization audit (all endpoints)
- [ ] Security review: OWASP Top 10 checklist
- [ ] Review CORS policy
- [ ] Implement DB backup script (`infra/scripts/backup-db.sh`)
- [ ] Implement R2 lifecycle rules (auto-delete raw assets after N days)
- [ ] Add database connection pooling (PgBouncer or Prisma pool limits)
- [ ] Document: runbook for common operational tasks

---

## Phase 9 — Billing-Ready Architecture 🔲 PENDING

**Goal:** Prepare schema and module boundaries for future subscription/billing without implementing payments.

- [ ] Finalize `Plan` model (name, maxMonthlyViews, maxQuality, features JSON)
- [ ] Finalize `Entitlement` model (userId, feature, expiresAt)
- [ ] Implement feature flag evaluation (can user access HD? can user download?)
- [ ] Implement video visibility enforcement (PUBLIC, SUBSCRIBERS_ONLY, PRIVATE)
- [ ] Create `BillingModule` skeleton in API (no Stripe, no payment routes)
- [ ] Define billing event interfaces (for future Stripe webhooks)
- [ ] Document: billing integration guide (what Stripe hooks will need to implement)

**NOT implemented in this phase:**
- Stripe integration
- Payment flows
- Subscription management UI
- Invoice generation

---

## Phase 10 — Stabilization + QA 🔲 PENDING

**Goal:** Test coverage, load testing, failure mode validation.

- [ ] Unit test coverage: all service classes > 80%
- [ ] Integration tests: all API endpoints
- [ ] E2E tests: full happy path (record → process → publish → play)
- [ ] Worker crash recovery test (kill worker mid-job, verify resume)
- [ ] Storage failure test (mock R2 unavailable, verify graceful degradation)
- [ ] Malformed media test (corrupted MP4, zero-byte file, wrong extension)
- [ ] Queue backpressure test (flood queue, verify concurrency limits hold)
- [ ] Performance test: API latency under load (k6)
- [ ] Security test: HMAC signature replay attack
- [ ] Database migration rollback test
- [ ] Full disaster recovery drill: restore DB + R2 from backup

---

## Known Technical Debt (at audit time)

See `docs/KNOWN_ISSUES.md` for full list. Key items:

1. `main.js` uses CommonJS — needs ESM/TypeScript migration
2. `convert.js` uses `bluebird` and `promise-queue` — deprecated deps
3. No SIGTERM handler in recorder — Docker stop will kill mid-recording
4. `moment.js` used for timestamps — replace with `Date` or `dayjs`
5. No minimumsecurity on INGEST_SERVICE_SECRET (env var exists but unused)
6. Storm WS URL hardcodes 'storm' substring — fragile pattern match
