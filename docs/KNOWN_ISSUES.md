# Known Issues — shwp-rec

> Technical debt and known risks identified at audit time.
> Last updated: 2026-05-16 | Phase: 1

---

## Critical

### KI-001: No crash recovery for active recordings

**File:** `main.js`
**Severity:** CRITICAL
**Description:** The `captures[]` array is in-memory. If the process dies (crash, OOM,
SIGKILL), all in-progress recordings are lost. There is no DB record, no checkpoint, no
way to resume.
**Fix:** Phase 4 — recorder reports state to API, API persists to DB. On restart, recorder
queries API for interrupted recordings.

---

### KI-002: No cloud storage — disk accumulation

**File:** `main.js`, `convert.js`
**Severity:** CRITICAL
**Description:** All recordings accumulate on local disk indefinitely. No cleanup, no
retention policy, no archival. Disk full = silent data loss (write errors discarded).
**Fix:** Phase 5 — storage abstraction with R2 provider. Phase 6 — cleanup jobs.

---

### KI-003: No ingest authentication

**File:** `main.js`
**Severity:** CRITICAL
**Description:** `INGEST_SERVICE_SECRET` is defined in `.env.example` but not used
anywhere. The recorder makes no authenticated calls to any API. Any process could
pretend to be the recorder.
**Fix:** Phase 4 — HMAC-signed ingest requests using `INGEST_SERVICE_SECRET`.

---

## High

### KI-004: No SIGTERM handler

**File:** `main.js` (line 394)
**Severity:** HIGH
**Description:** Only `SIGINT` (Ctrl+C) is handled. `docker stop` sends SIGTERM first,
then SIGKILL after 10s. Without a SIGTERM handler, Docker will kill the process mid-recording.
**Fix:** Add `process.on('SIGTERM', ...)` identical to the SIGINT handler.
**Workaround:** `docker stop --time 60` buys time but does not fix the root cause.

---

### KI-005: Memory exhaustion — one Playwright page per recording

**File:** `main.js` (line 117)
**Severity:** HIGH
**Description:** `browser.newPage()` is called for each active recording. At 50 concurrent
recordings (the config limit), 50+ browser contexts are open simultaneously. Playwright
contexts consume significant memory (50-200MB each). This can exhaust memory on typical
VPS deployments.
**Fix:** Phase 4 — evaluate direct HLS/RTMP capture without browser. If browser is required,
pool pages and share context.

---

### KI-006: Storm WS URL detection is fragile

**File:** `main.js` (line 134)
**Severity:** HIGH
**Description:** `ws.url().includes('storm')` is the only detection mechanism. If
showup.tv renames their CDN domain or changes the URL pattern, all recordings silently
stop writing data.
**Fix:** Add configurable WS URL pattern to config.yml. Add fallback detection. Add
monitoring alert for `capture.size === 0` after 60s.

---

### KI-007: Username used unsanitized in filesystem paths and page.goto()

**File:** `main.js` (line 113, 147)
**Severity:** HIGH
**Description:** `username` from the WebSocket payload is used directly in:
- Filename: `${username}_${timestamp}.mp4`
- URL: `page.goto(showup.tv/${encodeURIComponent(username)})`
- Filesystem path: `path.join(completeDirectory, capture.model, capture.filename)`

While `encodeURIComponent` helps for the URL, a username containing `../` or path
separators could create files outside the capture directory.
**Fix:** Sanitize username (allow only alphanumeric, `-`, `_`) before using in paths.

---

## Medium

### KI-008: CommonJS module system

**File:** `main.js`, `convert.js`
**Severity:** MEDIUM
**Description:** Both files use CommonJS (`require`, `module.exports`). The Turborepo
workspace is configured for TypeScript/ESM. This creates a module system mismatch.
**Fix:** Phase 4 — rewrite recorder in TypeScript/ESM as `apps/recorder`.

---

### KI-009: moment.js dependency

**File:** `main.js`, `convert.js`
**Severity:** MEDIUM
**Description:** `moment.js` is deprecated. It adds 300KB+ to the bundle and has known
timezone issues.
**Fix:** Replace with `Date` + `date-fns` or just `new Date().toISOString()` for timestamps.

---

### KI-010: bluebird and promise-queue in convert.js

**File:** `convert.js`
**Severity:** MEDIUM
**Description:** `bluebird` is a legacy promise library. `promise-queue` has not been
updated in 7+ years. Both are unnecessary in modern Node.js.
**Fix:** Phase 6 — convert.js is replaced by `apps/worker` with BullMQ.

---

### KI-011: No coordination between main.js and convert.js

**File:** `main.js`, `convert.js`
**Severity:** MEDIUM
**Description:** Both processes run independently, scanning the same filesystem. If a file
is moved to `complete/` while `convert.js` is scanning, race conditions can occur (ENOENT
on a file that just moved).
**Fix:** Phase 6 — processing jobs are enqueued via BullMQ. No filesystem scanning.

---

### KI-012: onlineFemales.clear() discards real-time state

**File:** `main.js` (line 311)
**Severity:** MEDIUM
**Description:** Every 2 minutes, `onlineFemales.clear()` resets all known online models.
The map is then rebuilt from the SSR homepage and a 10s WS burst. Models that came online
after the last burst but before the clear may be missed for up to 2 minutes.
**Fix:** Do not clear — maintain the map and expire entries that haven't been seen in
the WS for N minutes. Or reduce the scan interval.

---

### KI-013: No minimum file size check before upload

**File:** `main.js` (line 93)
**Severity:** MEDIUM
**Description:** `minFileSizeMb` (default 5MB) is checked before moving the file, but
after the WebSocket was written for the full recording. This is correct behavior, but once
we move to R2 multipart uploads, we need a minimum threshold at the `complete` event rather
than after-the-fact.
**Fix:** Phase 4 — define minimum duration (e.g., 60s) tracked by `captureStartTime`,
not file size.

---

## Low

### KI-014: No version pinning in package.json

**File:** `package.json` (root)
**Severity:** LOW
**Description:** devDependencies use caret ranges (`^`). Add lockfile (`package-lock.json`
is present) and pin all production deps.

---

### KI-015: config.yml hardcodes Polish UI text

**File:** `main.js` (line 153)
**Severity:** LOW
**Description:** `page.click('button:has-text("Wchodzę")')` hardcodes Polish text.
If showup.tv changes the button label or adds other-language variants, the dismiss fails
silently. This is non-critical (recording continues without dismissal) but should be
configurable.
**Fix:** Add `consentButtonText` to config.yml.
