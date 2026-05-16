# Claude Execution Plan

This document serves as the strict, phased execution guide for the Claude AI Agent operating in this repository.

**MANDATORY RULE:** Claude MUST NEVER hallucinate large swaths of undocumented architecture. Every implementation step must map exactly to this plan. Claude must validate its work after each phase.

## Phase 1: Documentation & Scaffold (Foundation)
- [x] Generate Core Documentation (`CURRENT_STATE.md`, etc.).
- [ ] Initialize Turborepo. Move `main.js` and `convert.js` to a `legacy/` folder. Setup `apps/` and `packages/` directories.
- [ ] Initialize `packages/db` with Prisma. Create `schema.prisma` with `Model`, `Stream`, and `Job` entities.
- [ ] Create root `docker-compose.yml` for Postgres, Redis, and MinIO.

## Phase 2: Core Infrastructure & Queues
- [ ] Initialize `packages/queue`. Install BullMQ. Define typed queue instances (e.g., `recordQueue`, `processQueue`).
- [ ] Scaffold `apps/service-scheduler`. Implement a robust polling mechanism (replacing the recursive `setTimeout` from `main.js`) that fetches online models and enqueues jobs to BullMQ.

## Phase 3: Distributed Recording Engine
- [ ] Scaffold `apps/worker-recorder`.
- [ ] Port the Playwright / WebSocket interception logic from `legacy/main.js` into the BullMQ job processor.
- [ ] Implement robust file stream handling to a shared temporary directory.
- [ ] Implement graceful job completion and enqueuing of the subsequent `ProcessMediaJob`.

## Phase 4: Media Processing Pipeline
- [ ] Scaffold `apps/worker-processor`.
- [ ] Port `ffprobe` and `ffmpeg` logic from `legacy/convert.js` into the BullMQ job processor.
- [ ] Add thumbnail generation (`fluent-ffmpeg`).
- [ ] Add AWS SDK (S3 client) to upload files to MinIO.
- [ ] Update Prisma `Stream` record to `PUBLISHED` upon completion.

## Phase 5: Next.js Frontend & Admin Dashboard
- [ ] Scaffold `apps/web` using Next.js App Router.
- [ ] Build Public UI: Homepage (grid of latest VODs), Model page, Video Player page.
- [ ] Build Admin UI: Integrate `@bull-board/ui` into a Next.js route for queue monitoring.

## Phase 6: Productionization
- [ ] Dockerize all applications: `apps/web/Dockerfile`, `apps/worker-recorder/Dockerfile`, etc.
- [ ] Write integration tests for the recording pipeline.
- [ ] Finalize `README.md` with deployment instructions for a multi-node environment.

### Operating Directives for Claude
- **Validation:** After scaffolding a package (e.g., `packages/db`), run `npx prisma generate` and write a small test script to ensure DB connectivity before moving to the next phase.
- **Dependencies:** Always check `package.json` at the root and workspace level to ensure consistent dependency versions.
- **Clean Architecture:** Keep business logic decoupled from transport (BullMQ).
