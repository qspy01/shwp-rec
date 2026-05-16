# Architectural Decisions Log

## ADR-002: Distributed Worker Architecture
**Context:** The legacy `main.js` spawned up to 50 concurrent Puppeteer instances in a single Node process. This is unscalable and unstable.
**Decision:** We are moving to a distributed worker architecture using BullMQ and Redis.
**Consequences:** Requires setting up Redis. Recording logic is isolated to `worker-recorder` containers, allowing horizontal scaling across multiple VMs.

## ADR-003: Database Selection
**Context:** The application needs to store VOD metadata, stream states, and user information.
**Decision:** PostgreSQL managed by Prisma ORM.
**Consequences:** Provides robust relational integrity, excellent typing via Prisma, and is standard for production apps.

## ADR-004: Media Storage
**Context:** Storing large `.mp4` files on the local disk of the worker node prevents horizontal scaling and risks data loss on container restart.
**Decision:** MinIO (S3-compatible object storage).
**Consequences:** Workers process files locally in a temp volume, then upload to MinIO. The frontend serves VODs directly from MinIO, decoupling storage from compute.

## ADR-005: Frontend Framework
**Context:** We need a public VOD gallery and a private Admin dashboard.
**Decision:** Next.js (App Router).
**Consequences:** Fits perfectly into the Turborepo monorepo, supports SSR for SEO (public VODs), and allows simple API route integration for the Admin dashboard.
