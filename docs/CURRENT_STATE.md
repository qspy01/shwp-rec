# Current State — shwp-rec

> Last updated: 2026-05-16 | Phase: 1 — Architecture Audit

---

## What This Codebase Is

`shwp-rec` is a showup.tv live stream recorder. It monitors the platform for active female
broadcasts, intercepts the binary WebSocket stream from the Storm CDN, and writes raw fMP4
data to the local filesystem. A separate converter process (`convert.js`) runs FFmpeg to
normalize `.ts`/`.flv` files into MP4.

This is **not** a VOD platform. It has no API, no database, no user auth, no frontend, and
no cloud storage. All state is in-memory and all output is on the local disk.

---

## Entrypoints

| File | Role |
|---|---|
| `main.js` | Primary recorder process — runs indefinitely |
| `convert.js` | Secondary FFmpeg converter — runs independently |
| `config.yml` | Recorder runtime config |
| `convert.yml` | Converter runtime config |

---

## Recording Lifecycle (main.js)

```
Bootstrap
  └─ mkdirp(captures/, complete/)
  └─ chromium.launch() → headless stealth browser
  └─ browser.newPage() → mainPage
  └─ attachAppWsListener(mainPage)
  └─ refreshMainPage() → loads showup.tv
  └─ mainLoop() → runs every config.modelScanInterval seconds (default: 120s)

mainLoop()
  └─ ensureBrowser() → relaunch if disconnected
  └─ onlineFemales.clear() → resets online map
  └─ refreshMainPage() → reloads showup.tv, seeds onlineFemales from SSR data
  └─ await 10s → collect WS burst from app socket
  └─ split: withKey (aliasStreamKey known) vs withoutKey
  └─ withKey → startRecording() immediately
  └─ withoutKey → fetchAliasKey() in batches of 5, then startRecording()
  └─ checkCapture() on all active captures → health check

startRecording(uid, username, aliasStreamKey)
  └─ isAlreadyCapturing() guard
  └─ captures.length >= maxConcurrentRecordings guard
  └─ filename = `${username}_${YYYYMMDD-HHmmss}.mp4`
  └─ fs.createWriteStream(captures/${filename})
  └─ browser.newPage() → new Playwright page per recording
  └─ page.on('websocket') → intercept Storm WS
      └─ ws.url().includes('storm') → binary frames → fileStream.write(buf)
  └─ page.goto(showup.tv/${username}) → triggers video player
  └─ optional: click "Wchodzę" (consent button)

finalizeCapture(capture)
  └─ removes from captures[]
  └─ closes Playwright page
  └─ fileStream.end()
  └─ fs.statSync → check file size (< minFileSizeMb → delete)
  └─ mv(captures/${filename} → complete/${filename})

Health check (checkCapture)
  └─ every 10 min per active capture
  └─ if time since lastChunk > 90s → finalizeCapture()
```

---

## Conversion Lifecycle (convert.js)

```
mainLoop() — runs every config.dirScanInterval seconds (default: 300s)
  └─ filewalker(complete/) → find .ts / .flv files > 10KB
  └─ queue (maxConcur default: 1) → convertFile()
      └─ ffprobe → detect audio codec (AAC vs other)
      └─ ffmpeg → copy video, re-encode/copy audio → tempDst
      └─ rename tempDst → dstFile in converted/
      └─ delete or .bak original
```

---

## Data Flow

```
showup.tv Storm CDN
    │ binary WebSocket frames (fMP4)
    ▼
Playwright page (one per model)
    │ framereceived events
    ▼
fs.createWriteStream
    │
    ▼
captures/${username}_${timestamp}.mp4   [IN PROGRESS — local disk]
    │ finalizeCapture (mv)
    ▼
complete/${username}_${timestamp}.mp4   [COMPLETE — local disk]
    │ convert.js (FFmpeg)
    ▼
converted/${username}_${timestamp}.mp4  [CONVERTED — local disk]
```

Everything lives on local disk. Nothing is tracked in a database. Nothing is uploaded to
cloud storage.

---

## State Management

| State | Storage | Crash-safe? |
|---|---|---|
| Active captures | `captures[]` in-memory array | NO — lost on crash |
| Online models | `onlineFemales` Map in-memory | NO — rebuilt on restart |
| Recording files | Local disk `captures/` | PARTIAL — file exists but no DB record |
| Completed files | Local disk `complete/` | NO DB tracking |
| Converted files | Local disk `converted/` | NO DB tracking |

---

## Technology

| Technology | Version/Details | Notes |
|---|---|---|
| Node.js | CommonJS (`'use strict'`) | ESM migration needed |
| Playwright | `playwright-extra` + stealth | Used for WS interception |
| FFmpeg | Spawned as child process | No concurrency limits in main.js |
| moment.js | Used for timestamps | Legacy; replace with Date/dayjs |
| bluebird | Used in convert.js only | Deprecated promise library |
| js-yaml | Config loading | Fine |
| colors | Console coloring | |
| mkdirp | Directory creation | |
| mv | File moving | |
| promise-queue | Concurrency limiter in convert.js | Simple, adequate |
| filewalker | Directory scanning in convert.js | |

---

## Scalability Issues

### Critical

1. **No crash recovery** — all active captures are in-memory. Process crash = data loss.
   Every in-progress recording since last scan is lost.

2. **No database** — there is no record of what has been recorded, what is being recorded,
   or what has been processed. Cannot query, report, or retry.

3. **No cloud storage** — all recordings accumulate on local disk. Disk full = silent
   data loss. No retention policy, no cleanup, no archival.

4. **No coordination** — `main.js` and `convert.js` run with no shared coordination.
   Both scan the filesystem independently. Race conditions possible.

5. **No upload pipeline** — recordings are never automatically uploaded anywhere.
   They sit on disk until someone manually moves them.

### High

6. **Browser per recording** — each active model gets a dedicated Playwright browser page.
   At 50 concurrent recordings, 50 browser contexts are open. Memory exhaustion risk.

7. **No retry logic** — if a recording page fails to navigate, capture is finalized with
   whatever was written. No automatic retry.

8. **Unbounded file accumulation** — no cleanup jobs. `complete/` and `converted/` grow
   forever.

9. **No health endpoint** — no HTTP interface to check if recorder is alive or how many
   recordings are in flight.

10. **onlineFemales.clear() on every scan** — state is reset every 2 minutes. Any model
    that was missed by SSR and WS burst is not re-discovered until next scan.

### Medium

11. **Sequential health checks** — `await Promise.allSettled(captures.map(checkCapture))`
    is parallel but finalization involves page.close() which can block.

12. **No signal handling for SIGTERM** — only SIGINT (Ctrl+C) is handled. Docker stop
    will SIGTERM which is unhandled.

13. **No observability** — only `console.log`. No structured logs, no metrics, no tracing.

14. **Monorepo scaffold is empty** — `apps/*` has no apps. `packages/shared/src` is empty.

---

## Security Issues

1. **No ingest authentication** — recorder has no credential to prove it is legitimate.
   The INGEST_SERVICE_SECRET env var exists in `.env.example` but is not used anywhere.

2. **No input validation** — model usernames from WS are used directly in `page.goto()`
   and filesystem paths without sanitization.

3. **Debug mode reveals internal state** — in debug mode, capture sizes and model names
   are logged. This is acceptable for internal tooling but would need masking in a
   production multi-tenant system.

---

## What Already Works (Keep)

- WebSocket interception mechanism (Storm WS binary frame capture) — core value
- Stealth browser approach to avoid bot detection
- fMP4 file writing (correct format for HLS segmentation later)
- FFmpeg conversion logic (audio codec detection, AAC copy vs re-encode)
- Turborepo workspace setup (apps/*, packages/*)
- `.env.example` defines exactly the right infrastructure env vars

---

## What Must Be Replaced

| Current | Target |
|---|---|
| In-memory captures array | PostgreSQL (via Prisma) |
| Local filesystem storage | Cloudflare R2 (via storage abstraction) |
| No API | NestJS API on `/api/v1` |
| No ingest auth | HMAC-signed ingest requests with INGEST_SERVICE_SECRET |
| No processing pipeline | BullMQ jobs → FFmpeg worker |
| No observability | Structured logs + Prometheus + Sentry |
| No frontend | Next.js VOD frontend |
| Single-process recorder | Isolated `apps/recorder` with DB reporting |
| convert.js standalone | `apps/worker` with BullMQ queue |
