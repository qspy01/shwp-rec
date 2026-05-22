FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/
COPY apps/service-scheduler/package.json ./apps/service-scheduler/

RUN npm ci

COPY packages/ ./packages/
COPY apps/service-scheduler/ ./apps/service-scheduler/

RUN cd packages/db && npx prisma generate
RUN npx turbo build --filter=service-scheduler

# ---- Runner ----
FROM node:20-slim AS runner
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/
COPY apps/service-scheduler/package.json ./apps/service-scheduler/

RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/queue/dist ./packages/queue/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/service-scheduler/dist ./apps/service-scheduler/dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/service-scheduler/dist/index.js"]
