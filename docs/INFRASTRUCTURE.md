# Infrastructure Specification

## Target Environment
The application will be deployed on a Self-Hosted / Dedicated Worker Nodes setup using Docker and Docker Compose (with an upgrade path to Docker Swarm for multi-node distribution).

## 1. Local Development (Docker Compose)
A `docker-compose.yml` will be provided at the repository root to instantly spin up the entire dependency stack:
- **`db`**: PostgreSQL 16 (Port 5432)
- **`redis`**: Redis 7 (Port 6379)
- **`minio`**: MinIO Server (Port 9000 API, 9001 Console)
- **`pgadmin`**: Optional, for DB inspection.

## 2. Production Topology

### 2.1. Control Plane Node
- **PostgreSQL Database** (Ideally running on a managed service or SSD-backed VM with daily backups).
- **Redis Server** (Requires low latency to workers, memory-optimized).
- **Scheduler Service** (`service-scheduler`).
- **Web App / API** (`apps/web` Next.js server).
- **Reverse Proxy** (Traefik / Nginx handling SSL termination and routing).

### 2.2. Worker Nodes (Compute Heavy)
These nodes can be scaled horizontally. They need high CPU and RAM for headless browsers and FFmpeg processing.
- **Recorder Workers** (`worker-recorder` containers). Memory limit: ~2GB per Chromium instance.
- **Processor Workers** (`worker-processor` containers). CPU limit: High, for fast FFmpeg encoding.
- **Shared Temporary Volume:** A mounted NFS drive or fast local NVMe where raw captures are written before being processed and uploaded to MinIO.

### 2.3. Storage Node (I/O Heavy)
- **MinIO Cluster:** Dedicated VMs with large attached Block Storage (HDD/SSD) running MinIO in distributed mode. This stores the final VODs and thumbnails.

## 3. Environment Variables Strategy
A unified `.env` file structure will be used, with secrets injected at runtime:
- `DATABASE_URL`: Prisma connection string.
- `REDIS_URL`: BullMQ connection string.
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`.
- `WORKER_CONCURRENCY`: To dynamically limit the number of browsers a specific node will spawn based on its hardware.

## 4. Observability & Monitoring
- **Prometheus:** Scrapes `/metrics` endpoints from BullMQ (via `@bull-board/ui` or custom exporter), Next.js, and Node.js workers.
- **Grafana:** Dashboards visualizing:
  - Queue depth (number of models waiting to be recorded).
  - Worker CPU/Memory usage (to detect OOM risks).
  - Storage growth in MinIO.
  - Application error rates.
- **Logging:** Container stdout/stderr collected via Docker logging drivers (e.g., json-file to Promtail/Loki).
