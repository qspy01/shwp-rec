# Target Production Architecture

## Overview
To achieve a reliable, 24/7 automated VOD platform, the monolithic legacy scripts will be replaced by a distributed, cloud-native (self-hosted) architecture. The system is designed to decouple stream discovery, recording, media processing, and presentation into isolated services communicating via robust message queues.

## 1. System Components

### 1.1. Core Services (Turborepo)
- **`apps/service-scheduler` (The Brain):**
  - Lightweight Node.js cron service.
  - Periodically polls the upstream platform for online models.
  - Queries the Database to determine if a model is already being recorded.
  - Dispatches `RecordStreamJob` to the Redis queue.
- **`apps/worker-recorder` (The Brawn):**
  - Node.js worker consuming `RecordStreamJob`.
  - Spawns a Playwright instance to intercept the WebSocket stream.
  - Writes raw `.mp4` chunks to a temporary shared volume.
  - On stream end or timeout, enqueues a `ProcessMediaJob`.
  - Designed to scale horizontally (e.g., 5-10 concurrent recordings per container).
- **`apps/worker-processor` (The Refiner):**
  - Node.js worker consuming `ProcessMediaJob`.
  - Executes FFmpeg to mux/convert raw chunks.
  - Extracts thumbnails and metadata (duration, resolution).
  - Uploads finalized media to MinIO (S3).
  - Updates the Database to mark the VOD as "Published".
- **`apps/web` (The Face):**
  - Next.js App Router application.
  - **Public View:** Browse, search, and playback VODs.
  - **Admin Dashboard:** Monitor BullMQ queues, worker health, manage models, and review logs.

### 1.2. Infrastructure Stack
- **Database:** PostgreSQL (managed via Prisma). Single source of truth for Models, Streams, VOD metadata, and User accounts.
- **Queue/Cache:** Redis. Powers BullMQ for reliable job delivery, retries, and rate limiting. Acts as a cache for API responses.
- **Object Storage:** MinIO. S3-compatible storage for VOD `.mp4` files and thumbnails. Highly scalable and decoupled from compute nodes.
- **Proxy/CDN:** Nginx or Traefik to route traffic to the Next.js app, API, and directly serve media from MinIO.

## 2. Data Flow
1. **Discovery:** `service-scheduler` detects Model A is online.
2. **Scheduling:** Scheduler inserts a DB record `Stream(status=RECORDING)` and adds a job to BullMQ `queue:record`.
3. **Recording:** `worker-recorder` picks up the job, opens Playwright, and saves chunks to `/mnt/shared/captures/ModelA_uuid.mp4`.
4. **Transition:** Stream ends. Worker updates DB `Stream(status=PROCESSING)` and adds a job to BullMQ `queue:process`.
5. **Processing:** `worker-processor` muxes the file, extracts `thumb.jpg`, and uploads both to MinIO `s3://vods/ModelA/uuid.mp4`.
6. **Publishing:** Processor updates DB `Stream(status=PUBLISHED, s3_key=..., duration=...)`.
7. **Consumption:** User visits `apps/web` and plays the VOD directly served from MinIO via CDN.

## 3. Scalability Strategy
- **Worker Scaling:** If the queue depth of `queue:record` increases, more `worker-recorder` containers can be spun up across different VMs.
- **Storage:** MinIO can be clustered across multiple drives or nodes as media storage needs grow.
- **Statelessness:** All Node.js services are entirely stateless. If a `worker-recorder` crashes, BullMQ detects the stalled job and assigns it to another worker (with the partial file managed accordingly or restarted).
