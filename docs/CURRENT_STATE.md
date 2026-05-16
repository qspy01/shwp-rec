# Current State Audit

## Overview
The current repository `shwp-rec` contains a basic, monolithic proof-of-concept for capturing and processing livestreams. It is implemented in two standalone Node.js scripts (`main.js` and `convert.js`) and relies heavily on local file systems, manual startup, and in-memory state.

## 1. What Currently Works
- **WS Interception:** `main.js` successfully uses Playwright/Puppeteer (with stealth plugin) to navigate to the target site, intercept WebSocket connections (`/app` for events, `storm` for media), and extract raw binary frames.
- **Raw Chunk Saving:** Binary chunks from the `storm` WebSocket are written sequentially to a `.mp4` file on the local disk.
- **Conversion Trigger:** `convert.js` can scan a local directory (`complete/`) and invoke `ffprobe` / `ffmpeg` via child processes to convert raw chunks into finalized `.mp4` files using a local queue.
- **Periodic Scanning:** `main.js` implements a rudimentary timer-based scan of the homepage to discover new livestreams.

## 2. What Partially Works
- **State Management:** `main.js` keeps an in-memory array of `captures` and a Map of `onlineFemales`. If the script crashes, all state is lost, resulting in unfinalized files and lost tracking.
- **Health Checks:** There is a naive health check based on `lastChunkTime`. If 90 seconds pass without a chunk, the capture is finalized. This is brittle against network blips and doesn't support resuming.

## 3. What is Broken
- **Concurrency & Resource Management:** `main.js` limits concurrent recordings to 50, but opening 50 Chromium instances in a single Node.js process on a typical machine will cause severe RAM exhaustion and OOM (Out Of Memory) crashes.
- **Error Handling:** WebSocket disconnections or Playwright page crashes often leave zombie browser processes or unclosed file streams.
- **File Finalization Race Conditions:** The process of moving files from `captures/` to `complete/` and then converting them via `convert.js` is prone to race conditions if `convert.js` picks up a file that hasn't fully flushed.

## 4. What is Missing
- **Database:** No persistent storage for Models, Streams, or Job states.
- **Queues:** No robust job orchestration (e.g., Redis/BullMQ) to handle retries, delays, and distribution across multiple machines.
- **Distributed Processing:** Both recording and conversion happen on the same machine.
- **Frontend / VOD Platform:** There is no web interface to view the recorded videos or manage the system.
- **Deployment & Containerization:** No Dockerfiles or deployment manifests.
- **Monitoring & Observability:** No metrics, logging aggregation, or alerting.
- **Metadata Extraction:** No thumbnail generation or duration calculations for the final VODs.

## 5. What Blocks Production Deployment
- **Monolithic Architecture:** Cannot scale horizontally. If the machine's bandwidth or CPU is maxed out, no more streams can be recorded.
- **State Loss on Crash:** Deployment rollouts or crashes will interrupt active recordings and leave corrupted files.
- **Local Disk Dependency:** Relies on local disk paths (`captures/`, `complete/`), making it impossible to scale horizontally across multiple stateless containers.

## 6. What Blocks Automation
- **Lack of Cron/Scheduler Service:** Relying on a long-running Node.js process to do `setTimeout` polling is unreliable. A dedicated scheduler service backed by a DB/Queue is needed.
- **Manual Conversion Run:** `convert.js` operates as an isolated loop. It should be an event-driven worker responding to "Capture Finished" events.

## 7. What Blocks Scalability
- **Puppeteer Concurrency:** Using headless browsers for media extraction is heavy. While necessary due to the target site's architecture (WebSockets + Obfuscation), scaling requires distributing these Playwright instances across many lightweight worker nodes.
- **File System Bottlenecks:** Local disk I/O will quickly become a bottleneck. We need to upload chunks to an S3-compatible store (MinIO) or use a fast, shared network volume for temporary processing before uploading the final asset.

## 8. What Blocks Reliability
- **Lack of Retries:** If a browser page fails to load, there is no system to automatically retry the job on another worker.
- **No Orchestration:** Without a queueing system, if the recording worker goes down, the system has no knowledge of which streams were active and need to be restarted.
