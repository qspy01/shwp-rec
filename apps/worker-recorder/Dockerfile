FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker-recorder/package.json ./apps/worker-recorder/

RUN npm ci

COPY packages/ ./packages/
COPY apps/worker-recorder/ ./apps/worker-recorder/

RUN cd packages/db && npx prisma generate
RUN npx turbo build --filter=worker-recorder

# ---- Runner ----
# Playwright image includes all Chromium system dependencies
FROM mcr.microsoft.com/playwright:v1.40.0-focal AS runner
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/queue/package.json ./packages/queue/
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker-recorder/package.json ./apps/worker-recorder/

RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/queue/dist ./packages/queue/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/worker-recorder/dist ./apps/worker-recorder/dist

# Install Chromium browser binary (system deps already in base image)
RUN npx playwright install chromium

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

CMD ["node", "apps/worker-recorder/dist/index.js"]
