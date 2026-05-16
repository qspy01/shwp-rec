# Project TODO

## Phase 1: Foundation
- [x] Write architectural documentation.
- [ ] Migrate repository to Turborepo structure.
- [ ] Move legacy scripts to `legacy/` folder.
- [ ] Setup `docker-compose.yml` (Postgres, Redis, MinIO).
- [ ] Initialize Prisma (`packages/db`).
- [ ] Design Prisma Schema (Models, Streams, Users).

## Phase 2: Orchestration
- [ ] Setup BullMQ (`packages/queue`).
- [ ] Build Scheduler Service (`apps/service-scheduler`).
- [ ] Implement polling logic and enqueue logic.

## Phase 3: Workers
- [ ] Build Recorder Worker (`apps/worker-recorder`).
- [ ] Port Puppeteer logic.
- [ ] Build Processor Worker (`apps/worker-processor`).
- [ ] Port FFmpeg logic.
- [ ] Integrate MinIO S3 upload.

## Phase 4: Frontend
- [ ] Scaffold Next.js (`apps/web`).
- [ ] Build Video Player UI.
- [ ] Build Admin Dashboard with Bull Board.

## Phase 5: Deployment
- [ ] Write Dockerfiles for all apps.
- [ ] Configure Prometheus metrics.
- [ ] Update README with production instructions.
