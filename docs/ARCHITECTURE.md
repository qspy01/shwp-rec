# Architecture — shwp-rec VOD Platform

> Last updated: 2026-05-16 | Phase: 1 — Architecture Audit

---

## Vision

Transform the showup.tv recorder into a production-grade **legal VOD platform**:
- Automated ingest pipeline (recordings created automatically, no user uploads)
- Async video processing (HLS transcoding, thumbnails)
- Public/private video playback
- Scalable modular monolith (not microservices — not yet)
- Billing-ready architecture (subscriptions, entitlements — not yet implemented)

---

## Guiding Principles

1. **Modular monolith first** — shared database, shared Redis, single deployment unit
2. **Explicit boundaries** — each module has a clear interface; no cross-module DB calls
3. **Storage is not truth** — local filesystem is temporary; DB + R2 + BullMQ are truth
4. **Internal ingest only** — no public upload endpoints; recorder authenticates via secret
5. **Billing-ready, not billing-complete** — schema and interfaces are designed to support
   subscriptions and entitlements without implementing Stripe yet

---

## Domain Model

```
Video          — logical content entity (what users watch)
  └─ Source    — original ingest (raw recording from showup.tv)
  └─ Asset     — physical file in storage (raw, variant, segment, thumbnail)
  └─ Variant   — encoded version (1080p, 720p, 360p HLS)
  └─ Playlist  — HLS manifest (.m3u8)
  └─ Segment   — HLS chunk (.ts)
  └─ Thumbnail — generated preview image
```

These are never mixed. A `Video` entity does not know where its bytes are stored; that is
the `Asset`'s responsibility. A `Variant` does not know how the original was captured; that
is the `Source`'s responsibility.

---

## Target Repository Structure

```
shwp-rec/
├── apps/
│   ├── api/              # NestJS backend — auth, videos, ingest, admin
│   ├── frontend/         # Next.js — public VOD frontend
│   ├── recorder/         # Playwright recorder (isolated, reports to API)
│   └── worker/           # BullMQ workers — FFmpeg, HLS, thumbnails
│
├── packages/
│   ├── shared/           # Shared types, DTOs, domain constants
│   ├── config/           # Env validation (zod), shared config schemas
│   ├── storage/          # Storage abstraction (R2 provider + local provider)
│   ├── auth/             # JWT utilities, HMAC helpers, RBAC constants
│   └── types/            # API contract types (request/response shapes)
│
├── infra/
│   ├── docker/           # Per-app Dockerfiles
│   ├── nginx/            # Nginx config (proxy, rate-limiting headers)
│   └── scripts/          # DB migrate, seed, backup scripts
│
└── docs/
    ├── adr/              # Architecture Decision Records
    ├── ARCHITECTURE.md   # This file
    ├── CURRENT_STATE.md  # Codebase analysis
    ├── DECISIONS.md      # Decision log
    ├── KNOWN_ISSUES.md   # Technical debt register
    └── TODO.md           # Phased implementation roadmap
```

---

## Component Architecture

### apps/recorder

**Responsibility:** Monitor showup.tv, detect live broadcasts, capture fMP4 streams.

**Boundaries:**
- Does NOT write to database directly
- Does NOT manage files on local disk permanently
- Reports all events to `apps/api` via HTTP (signed with INGEST_SERVICE_SECRET)
- Uploads raw recordings to R2 via `packages/storage`
- Uses BullMQ to enqueue processing jobs (via API endpoint, not direct Redis access)

**Key flows:**
```
WS event: PUB_BROADCAST_STARTED
  → POST /api/v1/ingest/recordings (signed)
  → API creates Recording record in DB (status: CAPTURING)
  → Recorder captures Storm WS binary frames
  → Recorder uploads chunks to R2 as multipart upload

WS event: PUB_BROADCAST_FINISHED (or 90s no data)
  → Recorder completes multipart upload
  → POST /api/v1/ingest/recordings/:id/complete (signed)
  → API updates Recording status to CAPTURED
  → API enqueues ProcessingJob in BullMQ
```

**Crash recovery:**
- On startup, recorder calls GET /api/v1/ingest/recordings?status=CAPTURING
- Resumes or finalizes interrupted recordings

---

### apps/api

**Responsibility:** NestJS API — auth, video catalog, ingest, admin, processing triggers.

**Modules:**

| Module | Responsibility |
|---|---|
| `auth` | JWT auth, refresh tokens, RBAC |
| `users` | User management, profile, watch history |
| `videos` | Video entity CRUD, search, catalog |
| `ingest` | Internal-only ingest endpoints (signed requests) |
| `processing` | Job status, retry, webhook |
| `admin` | Admin-only APIs (moderation, user management) |
| `health` | /health, /metrics (Prometheus) |

**API versioning:** all public routes under `/api/v1`
**Ingest routes:** under `/api/v1/ingest` — HMAC-signed, no public access

---

### apps/worker

**Responsibility:** BullMQ job consumers — FFmpeg transcoding, HLS generation, thumbnails,
cleanup.

**Queues:**

| Queue | Jobs | Concurrency |
|---|---|---|
| `processing` | validate → transcode → segment → publish | 2 (CPU-bound) |
| `thumbnails` | extract keyframes | 4 |
| `cleanup` | delete orphans, enforce retention | 1 |

**Processing workflow per recording:**
```
1. validate      — ffprobe, reject malformed files
2. transcode     — ffmpeg: 1080p, 720p, 360p variants
3. segment       — ffmpeg: HLS segmentation, generate .m3u8
4. upload        — push segments + manifests to R2
5. publish       — update Video status to PUBLISHED in DB
6. cleanup       — delete raw asset from R2 if retention policy applies
```

All jobs are idempotent. Failed jobs retry with exponential backoff (max 5 attempts).

---

### apps/frontend

**Responsibility:** Next.js public VOD frontend.

**Key routes:**
- `/` — homepage (featured videos, categories)
- `/videos/[slug]` — video detail + HLS player
- `/categories/[slug]` — category browse
- `/search` — search results
- `/auth/login`, `/auth/register` — authentication
- `/profile` — user profile, watch history, favorites
- `/admin` — admin panel (RBAC-protected)

**Performance requirements:**
- Route-level code splitting (Next.js default)
- Server components where possible (video catalog pages)
- Client components only for: video player, auth forms, interactive UI
- Core Web Vitals targets: LCP < 2.5s, CLS < 0.1, FID < 100ms

---

### packages/storage

**Interface:**

```typescript
interface StorageProvider {
  upload(key: string, body: Readable, opts?: UploadOptions): Promise<StorageObject>
  download(key: string): Promise<Readable>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  signedUrl(key: string, expiresIn: number): Promise<string>
  multipartInit(key: string): Promise<string>            // returns uploadId
  multipartUploadPart(key, uploadId, partNumber, body): Promise<string>  // returns ETag
  multipartComplete(key, uploadId, parts): Promise<StorageObject>
  multipartAbort(key: string, uploadId: string): Promise<void>
}
```

**Providers:**
- `R2Provider` — Cloudflare R2 via AWS SDK v3 (S3-compatible)
- `LocalProvider` — local filesystem (development only)

Provider is selected via `STORAGE_PROVIDER=r2|local` env var. Business logic never
imports a provider directly — always uses the interface.

---

## Database Schema (Prisma — source of truth)

### Core entities

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  status        UserStatus @default(ACTIVE)
  role          Role     @default(USER)
  planId        String?
  plan          Plan?    @relation(...)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  // ... sessions, watchHistory, favorites
}

model Video {
  id          String      @id @default(uuid())
  slug        String      @unique
  title       String
  description String?
  status      VideoStatus @default(PENDING)
  visibility  Visibility  @default(PUBLIC)
  duration    Int?        // seconds
  source      Source?
  variants    Variant[]
  thumbnails  Thumbnail[]
  category    Category?   @relation(...)
  tags        Tag[]
  createdAt   DateTime    @default(now())
  publishedAt DateTime?
}

model Source {
  id          String   @id @default(uuid())
  videoId     String   @unique
  video       Video    @relation(...)
  modelUid    String
  modelName   String
  capturedAt  DateTime
  rawAsset    Asset?   @relation(...)
  status      SourceStatus
}

model Asset {
  id          String    @id @default(uuid())
  storageKey  String    @unique   // R2 key
  mimeType    String
  sizeBytes   BigInt
  checksum    String?
  sourceId    String?
  source      Source?   @relation(...)
  variantId   String?
  variant     Variant?  @relation(...)
  createdAt   DateTime  @default(now())
  deletedAt   DateTime?
}

model Variant {
  id          String   @id @default(uuid())
  videoId     String
  video       Video    @relation(...)
  resolution  String   // "1080p", "720p", "360p"
  bitrate     Int
  codec       String
  playlist    Playlist?
  asset       Asset?
  createdAt   DateTime @default(now())
}

model Playlist {
  id          String   @id @default(uuid())
  variantId   String   @unique
  variant     Variant  @relation(...)
  storageKey  String   // R2 key for .m3u8
  duration    Int
  segmentCount Int
}

model ProcessingJob {
  id          String        @id @default(uuid())
  videoId     String
  video       Video         @relation(...)
  type        JobType
  status      JobStatus     @default(PENDING)
  attempts    Int           @default(0)
  lastError   String?
  queueJobId  String?       // BullMQ job ID
  createdAt   DateTime      @default(now())
  startedAt   DateTime?
  completedAt DateTime?
}

// Billing-ready (not yet implemented)
model Plan {
  id              String @id @default(uuid())
  name            String @unique
  maxMonthlyViews Int
  maxQuality      String  // "360p", "720p", "1080p"
  // ... future: price, stripePriceId, features
}

model Entitlement {
  id      String @id @default(uuid())
  userId  String
  feature String  // "hd_playback", "download", "ad_free"
  // ... expiresAt, grantedById
}
```

---

## Infrastructure

### Docker Compose (development)

```yaml
services:
  postgres:   image: postgres:16
  redis:      image: redis:7-alpine
  api:        build: apps/api
  worker:     build: apps/worker
  frontend:   build: apps/frontend
  recorder:   build: apps/recorder
  nginx:      build: infra/nginx
```

### Nginx

- Terminates TLS (in production)
- Proxies `/api/v1` → `api:3001`
- Proxies `/` → `frontend:3000`
- Rate limiting headers
- HLS segment caching headers

### Cloudflare R2

- Storage bucket: `shwp-recordings`
- Public URL via Cloudflare CDN for published HLS segments
- Private URL for raw assets (signed URLs only)
- Bucket paths:
  ```
  raw/{modelName}/{date}/{recordingId}.mp4
  videos/{videoId}/variants/{resolution}/{filename}.m3u8
  videos/{videoId}/variants/{resolution}/segments/{n}.ts
  videos/{videoId}/thumbnails/{n}.jpg
  ```

### BullMQ + Redis

- Queue persistence: Redis with AOF enabled
- Queues: `processing`, `thumbnails`, `cleanup`
- Dead letter queue: `failed` (max 1000 jobs retained)
- Dashboard: Bull Board UI at `/admin/queues`

---

## Auth Architecture

### User auth (public API)
- JWT access token (15m) + refresh token (30d)
- Stored: refresh token in DB, access token stateless
- RBAC: USER, ADMIN roles
- Guards: `@Auth()`, `@AdminOnly()` decorators

### Ingest auth (recorder → API)
- HMAC-SHA256 signature on every request
- Header: `X-Ingest-Signature: sha256=<hmac>`
- Header: `X-Ingest-Timestamp: <unix-ms>`
- Replay protection: timestamp must be within ±30s
- Secret: `INGEST_SERVICE_SECRET` env var

---

## Observability

Every service emits:
- **Structured logs** (JSON, pino) with `correlationId`, `service`, `version`
- **Prometheus metrics** at `/metrics` — request rates, queue depths, error counts
- **Sentry** — error tracking with release tagging
- **Health check** at `/health` — DB ping, Redis ping, queue status

Worker-specific metrics:
- `worker_jobs_total{queue, status}` — jobs processed/failed/retried
- `worker_processing_duration_seconds` — FFmpeg duration histogram
- `worker_queue_depth{queue}` — current queue backlog

---

## Security Boundaries

| Boundary | Mechanism |
|---|---|
| Public API | JWT Bearer token |
| Admin routes | JWT + Role.ADMIN check |
| Ingest endpoints | HMAC-SHA256 signed requests |
| R2 raw assets | Signed URLs (time-limited) |
| R2 published segments | Cloudflare CDN public (HLS is already segmented) |
| Inter-service | Docker network isolation |
