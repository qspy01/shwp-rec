# Automated VOD Platform

A highly scalable, distributed, self-hosted system for automatically discovering, recording, and processing livestreams. This project transitions the legacy monolithic scripts (`main.js` and `convert.js`) into a production-ready Turborepo monorepo utilizing Docker, BullMQ, Redis, PostgreSQL, and MinIO.

## Architecture

The system is decoupled into independent microservices to ensure reliability, horizontal scalability, and safe crash recovery.

- **`service-scheduler`**: A lightweight Node.js/Playwright app that polls for online models and dispatches jobs to Redis. It also hosts the **Admin Dashboard (Bull-Board)** on port 3001.
- **`worker-recorder`**: Consumes `record-stream` jobs. Spawns headless Chromium instances to capture raw websocket chunks and stores them locally on a shared volume.
- **`worker-processor`**: Consumes `process-media` jobs. Uses `ffmpeg` to mux audio/video, generate thumbnails, extract metadata, and upload the final MP4/JPG to MinIO.
- **`web`**: A Next.js App Router frontend for browsing published VODs and streaming them directly from MinIO.

## Local Development (Docker Compose)

1. **Start the Infrastructure:**
   ```bash
   docker compose up -d
   ```
   *This starts PostgreSQL (port 5435), Redis (port 6385), and MinIO (ports 9005 & 9006) with a pre-configured `vods` bucket.*

2. **Initialize Database:**
   ```bash
   cd packages/db
   DATABASE_URL="postgresql://postgres:password@localhost:5435/shwprec" npx prisma db push
   ```

3. **Install Dependencies & Build:**
   From the repository root:
   ```bash
   npm install
   npm run build
   ```

4. **Run Services Locally:**
   Open separate terminals for each service:
   - **Scheduler:** `cd apps/service-scheduler && npm run dev`
   - **Recorder:** `cd apps/worker-recorder && npm run dev`
   - **Processor:** `cd apps/worker-processor && npm run dev`
   - **Frontend:** `cd apps/web && npm run dev`

## Dashboards
- **Frontend App:** `http://localhost:3000`
- **Admin Queue Monitor (Bull Board):** `http://localhost:3001/admin/queues`
- **MinIO Console:** `http://localhost:9006` (admin / password123)

## Production Deployment
For production deployment, it is highly recommended to run this on Docker Swarm or Nomad:
1. Provide a managed PostgreSQL database.
2. Provide a managed Redis instance or highly available Redis cluster.
3. Deploy MinIO across dedicated storage nodes.
4. Scale `worker-recorder` across multiple Compute-heavy VMs, binding `WORKER_CONCURRENCY` to the host's RAM (approx. 1GB per concurrent browser).
5. Expose `apps/web` via a CDN/Proxy (e.g., Traefik/Cloudflare).
