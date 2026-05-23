FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker-processor/package.json ./apps/worker-processor/

RUN npm ci

COPY packages/ ./packages/
COPY apps/worker-processor/ ./apps/worker-processor/

RUN cd packages/db && npx prisma generate
RUN npx turbo build --filter=worker-processor

# ---- Runner ----
FROM node:20-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker-processor/package.json ./apps/worker-processor/

RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/queue/dist ./packages/queue/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/worker-processor/dist ./apps/worker-processor/dist

ENV NODE_ENV=production

USER 1000:1000
CMD ["node", "apps/worker-processor/dist/index.js"]
