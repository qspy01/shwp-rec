# Phase 2 — Monorepo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the full Turborepo monorepo — five shared packages and four apps — so that `pnpm build` and `pnpm typecheck` pass clean across the entire workspace.

**Architecture:** Bottom-up construction: root wiring → packages (config, shared, types, auth, storage) → apps (api, worker, recorder, frontend) → infra. Each layer depends on the one below. No application logic in this phase — only correctly-typed, buildable skeletons. App logic comes in Phases 3–7.

**Tech Stack:** pnpm workspaces, Turborepo 2, TypeScript 5.4, NestJS 10, Next.js 14, BullMQ 5, Zod 3, jsonwebtoken, @aws-sdk/client-s3

---

## File Map

```
shwp-rec/
├── pnpm-workspace.yaml            ← NEW — pnpm workspace definition
├── tsconfig.base.json             ← NEW — shared TS compiler options
├── package.json                   ← MODIFY — add pnpm packageManager field
│
├── packages/
│   ├── config/                    ← NEW — Zod env validation schemas
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts           ← re-exports all schemas
│   │       ├── api.ts             ← API app env schema
│   │       ├── worker.ts          ← Worker app env schema
│   │       ├── recorder.ts        ← Recorder app env schema
│   │       └── frontend.ts        ← Frontend env schema
│   │
│   ├── shared/                    ← POPULATE — domain types, enums, constants
│   │   └── src/
│   │       ├── index.ts
│   │       ├── enums.ts           ← all shared enums
│   │       └── constants.ts       ← queue names, bucket paths, defaults
│   │
│   ├── types/                     ← NEW — API request/response shapes
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── videos.ts          ← VideoDto, ListVideosQuery, etc.
│   │       ├── auth.ts            ← LoginDto, RegisterDto, TokenDto
│   │       ├── ingest.ts          ← CreateRecordingDto, CompleteRecordingDto
│   │       └── users.ts           ← UserDto, UpdateProfileDto
│   │
│   ├── auth/                      ← NEW — JWT + HMAC utilities
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── jwt.ts             ← signToken, verifyToken
│   │       └── hmac.ts            ← signRequest, verifyRequest
│   │
│   └── storage/                   ← NEW — storage abstraction
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── provider.ts        ← StorageProvider interface + types
│           ├── local.ts           ← LocalProvider (dev fallback)
│           └── r2.ts              ← R2Provider (stub, real impl in Phase 5)
│
├── apps/
│   ├── api/                       ← NEW — NestJS skeleton
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── src/
│   │       ├── main.ts            ← bootstrap()
│   │       ├── app.module.ts      ← AppModule
│   │       └── health/
│   │           ├── health.module.ts
│   │           └── health.controller.ts   ← GET /health → {status:'ok'}
│   │
│   ├── frontend/                  ← NEW — Next.js 14 skeleton
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.js
│   │   └── src/app/
│   │       ├── layout.tsx
│   │       └── page.tsx           ← placeholder homepage
│   │
│   ├── recorder/                  ← NEW — TypeScript recorder skeleton
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts            ← entry point, imports recorder
│   │       ├── recorder.ts        ← RecorderService class (wraps main.js logic)
│   │       └── types.ts           ← Capture, OnlineModel interfaces
│   │
│   └── worker/                    ← NEW — BullMQ worker skeleton
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── main.ts            ← bootstrap worker
│           └── processors/
│               └── processing.processor.ts  ← stub job handler
│
└── infra/
    ├── docker/
    │   ├── api.Dockerfile
    │   ├── worker.Dockerfile
    │   ├── recorder.Dockerfile
    │   └── frontend.Dockerfile
    ├── nginx/
    │   └── nginx.conf
    └── docker-compose.yml
```

---

## Task 1: pnpm workspace + root config

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Modify: `package.json`

- [ ] **Step 1: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

- [ ] **Step 3: Update root package.json** — add `packageManager` field and keep existing content

```json
{
  "name": "shwp-rec",
  "version": "3.0.0",
  "private": true,
  "packageManager": "pnpm@11.0.9",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 4: Install root deps**

```bash
cd /root/shwp-rec
rm -f package-lock.json
pnpm install
```

Expected: pnpm installs turbo, typescript, @types/node. No errors.

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml tsconfig.base.json package.json
git rm --cached package-lock.json 2>/dev/null || true
git commit -m "chore: migrate to pnpm workspaces, add tsconfig.base"
```

---

## Task 2: packages/config — Zod env validation

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/src/index.ts`
- Create: `packages/config/src/api.ts`
- Create: `packages/config/src/worker.ts`
- Create: `packages/config/src/recorder.ts`
- Create: `packages/config/src/frontend.ts`

- [ ] **Step 1: Create packages/config/package.json**

```json
{
  "name": "@shwp/config",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "*"
  }
}
```

- [ ] **Step 2: Create packages/config/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/config/src/api.ts**

```typescript
import { z } from 'zod';

export const apiEnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  INGEST_SERVICE_SECRET: z.string().min(32, 'INGEST_SERVICE_SECRET must be at least 32 characters'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('shwp-recordings'),
  R2_PUBLIC_URL: z.string().url().optional(),
  STORAGE_PROVIDER: z.enum(['r2', 'local']).default('local'),
  SENTRY_DSN: z.string().url().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = apiEnvSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.errors.map(e => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid environment variables for API:\n${errors}`);
  }
  return result.data;
}
```

- [ ] **Step 4: Create packages/config/src/worker.ts**

```typescript
import { z } from 'zod';

export const workerEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  STORAGE_PROVIDER: z.enum(['r2', 'local']).default('local'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('shwp-recordings'),
  R2_PUBLIC_URL: z.string().url().optional(),
  FFMPEG_MAX_CONCURRENT: z.coerce.number().int().min(1).max(8).default(2),
  FFMPEG_TIMEOUT_MS: z.coerce.number().int().default(30 * 60 * 1000),
  SENTRY_DSN: z.string().url().optional(),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseWorkerEnv(env: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const result = workerEnvSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.errors.map(e => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid environment variables for Worker:\n${errors}`);
  }
  return result.data;
}
```

- [ ] **Step 5: Create packages/config/src/recorder.ts**

```typescript
import { z } from 'zod';

export const recorderEnvSchema = z.object({
  API_URL: z.string().url('API_URL must be a valid URL'),
  INGEST_SERVICE_SECRET: z.string().min(32),
  STORAGE_PROVIDER: z.enum(['r2', 'local']).default('local'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('shwp-recordings'),
  MAX_CONCURRENT_RECORDINGS: z.coerce.number().int().min(1).max(100).default(50),
  MODEL_SCAN_INTERVAL_SEC: z.coerce.number().int().min(30).default(120),
  MIN_FILE_SIZE_MB: z.coerce.number().min(0).default(5),
  DEBUG: z.coerce.boolean().default(false),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type RecorderEnv = z.infer<typeof recorderEnvSchema>;

export function parseRecorderEnv(env: NodeJS.ProcessEnv = process.env): RecorderEnv {
  const result = recorderEnvSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.errors.map(e => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid environment variables for Recorder:\n${errors}`);
  }
  return result.data;
}
```

- [ ] **Step 6: Create packages/config/src/frontend.ts**

```typescript
import { z } from 'zod';

export const frontendEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_CDN_URL: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type FrontendEnv = z.infer<typeof frontendEnvSchema>;

export function parseFrontendEnv(env: NodeJS.ProcessEnv = process.env): FrontendEnv {
  const result = frontendEnvSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.errors.map(e => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid environment variables for Frontend:\n${errors}`);
  }
  return result.data;
}
```

- [ ] **Step 7: Create packages/config/src/index.ts**

```typescript
export * from './api.js';
export * from './worker.js';
export * from './recorder.js';
export * from './frontend.js';
```

- [ ] **Step 8: Install and build**

```bash
cd /root/shwp-rec
pnpm install
cd packages/config
pnpm build
```

Expected: `dist/` folder created with `.js` and `.d.ts` files. No TypeScript errors.

- [ ] **Step 9: Commit**

```bash
cd /root/shwp-rec
git add packages/config/
git commit -m "feat(config): add Zod env validation schemas for all apps"
```

---

## Task 3: packages/shared — domain enums and constants

**Files:**
- Modify: `packages/shared/src/index.ts` (currently empty)
- Create: `packages/shared/src/enums.ts`
- Create: `packages/shared/src/constants.ts`

- [ ] **Step 1: Create packages/shared/src/enums.ts**

```typescript
export enum VideoStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
  PENDING = 'PENDING',
}

export enum Visibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  SUBSCRIBERS_ONLY = 'SUBSCRIBERS_ONLY',
}

export enum SourceStatus {
  CAPTURING = 'CAPTURING',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
}

export enum JobType {
  VALIDATE = 'VALIDATE',
  TRANSCODE = 'TRANSCODE',
  SEGMENT = 'SEGMENT',
  UPLOAD = 'UPLOAD',
  PUBLISH = 'PUBLISH',
  THUMBNAIL = 'THUMBNAIL',
  CLEANUP = 'CLEANUP',
}

export enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
```

- [ ] **Step 2: Create packages/shared/src/constants.ts**

```typescript
export const QUEUE_NAMES = {
  PROCESSING: 'processing',
  THUMBNAILS: 'thumbnails',
  CLEANUP: 'cleanup',
} as const;

export const STORAGE_PATHS = {
  raw: (modelName: string, date: string, recordingId: string) =>
    `raw/${modelName}/${date}/${recordingId}.mp4`,
  manifest: (videoId: string, resolution: string) =>
    `videos/${videoId}/variants/${resolution}/index.m3u8`,
  segment: (videoId: string, resolution: string, n: number) =>
    `videos/${videoId}/variants/${resolution}/segments/${n}.ts`,
  thumbnail: (videoId: string, n: number) =>
    `videos/${videoId}/thumbnails/${n}.jpg`,
} as const;

export const VIDEO_RESOLUTIONS = ['1080p', '720p', '360p'] as const;
export type VideoResolution = typeof VIDEO_RESOLUTIONS[number];

export const INGEST_TIMESTAMP_TOLERANCE_MS = 30_000;
export const ACCESS_TOKEN_EXPIRES_IN = '15m';
export const REFRESH_TOKEN_EXPIRES_DAYS = 30;
export const MIN_RECORDING_DURATION_SEC = 60;
```

- [ ] **Step 3: Create packages/shared/src/index.ts**

```typescript
export * from './enums.js';
export * from './constants.js';
```

- [ ] **Step 4: Build and verify**

```bash
cd /root/shwp-rec/packages/shared
pnpm build
```

Expected: `dist/` folder with compiled JS and type declarations. No errors.

- [ ] **Step 5: Commit**

```bash
cd /root/shwp-rec
git add packages/shared/src/
git commit -m "feat(shared): add domain enums and storage path constants"
```

---

## Task 4: packages/types — API contract types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`
- Create: `packages/types/src/videos.ts`
- Create: `packages/types/src/auth.ts`
- Create: `packages/types/src/ingest.ts`
- Create: `packages/types/src/users.ts`
- Create: `packages/types/src/common.ts`

- [ ] **Step 1: Create packages/types/package.json**

```json
{
  "name": "@shwp/types",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@shwp/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "*"
  }
}
```

- [ ] **Step 2: Create packages/types/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/types/src/common.ts**

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;
  correlationId?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}
```

- [ ] **Step 4: Create packages/types/src/auth.ts**

```typescript
export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
}

export interface TokenDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenDto {
  refreshToken: string;
}
```

- [ ] **Step 5: Create packages/types/src/users.ts**

```typescript
import type { UserRole, UserStatus } from '@shwp/shared';

export interface UserDto {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface UpdateProfileDto {
  displayName?: string;
}
```

- [ ] **Step 6: Create packages/types/src/videos.ts**

```typescript
import type { VideoStatus, Visibility, VideoResolution } from '@shwp/shared';
import type { PaginationQuery } from './common.js';

export interface VideoDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: VideoStatus;
  visibility: Visibility;
  duration: number | null;
  thumbnailUrl: string | null;
  hlsUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface ListVideosQuery extends PaginationQuery {
  categoryId?: string;
  search?: string;
  visibility?: Visibility;
}

export interface VariantDto {
  resolution: VideoResolution;
  playlistUrl: string;
}
```

- [ ] **Step 7: Create packages/types/src/ingest.ts**

```typescript
import type { SourceStatus } from '@shwp/shared';

export interface CreateRecordingDto {
  modelUid: string;
  modelName: string;
  capturedAt: string;
  r2UploadId?: string;
}

export interface CreateRecordingResponse {
  recordingId: string;
  videoId: string;
}

export interface CompleteRecordingDto {
  sizeBytes: number;
  durationSec?: number;
  r2Key: string;
  checksum?: string;
}

export interface RecordingStatusDto {
  recordingId: string;
  videoId: string;
  modelName: string;
  status: SourceStatus;
  capturedAt: string;
}
```

- [ ] **Step 8: Create packages/types/src/index.ts**

```typescript
export * from './common.js';
export * from './auth.js';
export * from './users.js';
export * from './videos.js';
export * from './ingest.js';
```

- [ ] **Step 9: Build**

```bash
cd /root/shwp-rec
pnpm install
cd packages/types
pnpm build
```

Expected: builds successfully, no TS errors.

- [ ] **Step 10: Commit**

```bash
cd /root/shwp-rec
git add packages/types/
git commit -m "feat(types): add API contract types for auth, videos, users, ingest"
```

---

## Task 5: packages/auth — JWT and HMAC utilities

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/src/index.ts`
- Create: `packages/auth/src/jwt.ts`
- Create: `packages/auth/src/hmac.ts`

- [ ] **Step 1: Create packages/auth/package.json**

```json
{
  "name": "@shwp/auth",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "*",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: Create packages/auth/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/auth/src/jwt.ts**

```typescript
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

export function signToken(
  payload: JwtPayload,
  secret: string,
  expiresIn: string | number,
): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string, secret: string): JwtPayload {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === 'string' || !('sub' in decoded)) {
    throw new Error('Invalid token payload');
  }
  return decoded as JwtPayload;
}
```

- [ ] **Step 4: Create packages/auth/src/hmac.ts**

```typescript
import { createHmac, timingSafeEqual } from 'crypto';
import { INGEST_TIMESTAMP_TOLERANCE_MS } from '@shwp/shared';

export function signRequest(body: string, secret: string, timestamp: number): string {
  const payload = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyRequest(
  signature: string,
  body: string,
  secret: string,
  timestamp: number,
): boolean {
  const now = Date.now();
  if (Math.abs(now - timestamp) > INGEST_TIMESTAMP_TOLERANCE_MS) {
    return false;
  }
  const expected = signRequest(body, secret, timestamp);
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Create packages/auth/src/index.ts**

```typescript
export * from './jwt.js';
export * from './hmac.js';
```

- [ ] **Step 6: Install deps and build**

```bash
cd /root/shwp-rec
pnpm install
cd packages/auth
pnpm build
```

Expected: no errors, `dist/` populated.

- [ ] **Step 7: Commit**

```bash
cd /root/shwp-rec
git add packages/auth/
git commit -m "feat(auth): add JWT sign/verify and HMAC request signing utilities"
```

---

## Task 6: packages/storage — storage abstraction

**Files:**
- Create: `packages/storage/package.json`
- Create: `packages/storage/tsconfig.json`
- Create: `packages/storage/src/provider.ts`
- Create: `packages/storage/src/local.ts`
- Create: `packages/storage/src/r2.ts`
- Create: `packages/storage/src/index.ts`

- [ ] **Step 1: Create packages/storage/package.json**

```json
{
  "name": "@shwp/storage",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/s3-request-presigner": "^3.600.0",
    "@shwp/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "*",
    "@types/node": "^20.0.0"
  }
}
```

- [ ] **Step 2: Create packages/storage/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/storage/src/provider.ts**

```typescript
import type { Readable } from 'stream';

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  public?: boolean;
}

export interface StorageObject {
  key: string;
  sizeBytes: number;
  etag?: string;
  url?: string;
}

export interface MultipartPart {
  partNumber: number;
  etag: string;
}

export interface StorageProvider {
  upload(key: string, body: Readable | Buffer, opts?: UploadOptions): Promise<StorageObject>;
  download(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  signedUrl(key: string, expiresIn: number): Promise<string>;
  multipartInit(key: string, opts?: UploadOptions): Promise<string>;
  multipartUploadPart(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<string>;
  multipartComplete(key: string, uploadId: string, parts: MultipartPart[]): Promise<StorageObject>;
  multipartAbort(key: string, uploadId: string): Promise<void>;
}
```

- [ ] **Step 4: Create packages/storage/src/local.ts**

```typescript
import { createReadStream, createWriteStream, statSync } from 'fs';
import { mkdir, unlink, access, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { StorageProvider, StorageObject, UploadOptions, MultipartPart } from './provider.js';

export class LocalProvider implements StorageProvider {
  private readonly parts = new Map<string, Buffer[]>();

  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    return join(this.baseDir, key);
  }

  async upload(key: string, body: Readable | Buffer, _opts?: UploadOptions): Promise<StorageObject> {
    const filePath = this.resolve(key);
    await mkdir(dirname(filePath), { recursive: true });
    if (Buffer.isBuffer(body)) {
      await writeFile(filePath, body);
    } else {
      await pipeline(body, createWriteStream(filePath));
    }
    const { size } = statSync(filePath);
    return { key, sizeBytes: size };
  }

  async download(key: string): Promise<Readable> {
    return createReadStream(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(key: string, _expiresIn: number): Promise<string> {
    return `file://${this.resolve(key)}`;
  }

  async multipartInit(key: string, _opts?: UploadOptions): Promise<string> {
    const uploadId = `local-${key}-${Date.now()}`;
    this.parts.set(uploadId, []);
    return uploadId;
  }

  async multipartUploadPart(
    _key: string,
    uploadId: string,
    _partNumber: number,
    body: Buffer,
  ): Promise<string> {
    const parts = this.parts.get(uploadId) ?? [];
    parts.push(body);
    this.parts.set(uploadId, parts);
    return `etag-${_partNumber}`;
  }

  async multipartComplete(
    key: string,
    uploadId: string,
    _parts: MultipartPart[],
  ): Promise<StorageObject> {
    const parts = this.parts.get(uploadId) ?? [];
    const combined = Buffer.concat(parts);
    this.parts.delete(uploadId);
    return this.upload(key, combined);
  }

  async multipartAbort(_key: string, uploadId: string): Promise<void> {
    this.parts.delete(uploadId);
  }
}
```

- [ ] **Step 5: Create packages/storage/src/r2.ts**

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import type { StorageProvider, StorageObject, UploadOptions, MultipartPart } from './provider.js';

export interface R2ProviderConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

export class R2Provider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl?: string;

  constructor(config: R2ProviderConfig) {
    this.bucketName = config.bucketName;
    this.publicUrl = config.publicUrl;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async upload(key: string, body: Readable | Buffer, opts?: UploadOptions): Promise<StorageObject> {
    const cmd = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: opts?.contentType,
      Metadata: opts?.metadata,
    });
    const result = await this.client.send(cmd);
    const url = this.publicUrl ? `${this.publicUrl}/${key}` : undefined;
    return { key, sizeBytes: Buffer.isBuffer(body) ? body.length : 0, etag: result.ETag, url };
  }

  async download(key: string): Promise<Readable> {
    const cmd = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    const result = await this.client.send(cmd);
    return result.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(key: string, expiresIn: number): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucketName, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn });
  }

  async multipartInit(key: string, opts?: UploadOptions): Promise<string> {
    const cmd = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: opts?.contentType,
    });
    const result = await this.client.send(cmd);
    return result.UploadId!;
  }

  async multipartUploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<string> {
    const cmd = new UploadPartCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
    });
    const result = await this.client.send(cmd);
    return result.ETag!;
  }

  async multipartComplete(key: string, uploadId: string, parts: MultipartPart[]): Promise<StorageObject> {
    const cmd = new CompleteMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map(p => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    });
    const result = await this.client.send(cmd);
    return { key, sizeBytes: 0, etag: result.ETag };
  }

  async multipartAbort(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucketName, Key: key, UploadId: uploadId }),
    );
  }
}
```

- [ ] **Step 6: Create packages/storage/src/index.ts**

```typescript
export * from './provider.js';
export * from './local.js';
export * from './r2.js';

export function createStorageProvider(config: {
  provider: 'r2' | 'local';
  localBaseDir?: string;
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2BucketName?: string;
  r2PublicUrl?: string;
}): import('./provider.js').StorageProvider {
  if (config.provider === 'r2') {
    if (!config.r2AccountId || !config.r2AccessKeyId || !config.r2SecretAccessKey) {
      throw new Error('R2 provider requires r2AccountId, r2AccessKeyId, r2SecretAccessKey');
    }
    const { R2Provider } = require('./r2.js');
    return new R2Provider({
      accountId: config.r2AccountId,
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
      bucketName: config.r2BucketName ?? 'shwp-recordings',
      publicUrl: config.r2PublicUrl,
    });
  }
  const { LocalProvider } = require('./local.js');
  return new LocalProvider(config.localBaseDir ?? './storage');
}
```

- [ ] **Step 7: Install and build**

```bash
cd /root/shwp-rec
pnpm install
cd packages/storage
pnpm build
```

Expected: no errors, `dist/` created.

- [ ] **Step 8: Commit**

```bash
cd /root/shwp-rec
git add packages/storage/
git commit -m "feat(storage): add StorageProvider interface with LocalProvider and R2Provider"
```

---

## Task 7: apps/api — NestJS skeleton

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.module.ts`
- Create: `apps/api/src/health/health.controller.ts`

- [ ] **Step 1: Create apps/api/package.json**

```json
{
  "name": "@shwp/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "typecheck": "tsc --noEmit",
    "test": "jest --passWithNoTests"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@shwp/config": "workspace:*",
    "@shwp/shared": "workspace:*",
    "@shwp/types": "workspace:*",
    "@shwp/auth": "workspace:*",
    "@shwp/storage": "workspace:*",
    "reflect-metadata": "^0.1.14",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "typescript": "*"
  }
}
```

- [ ] **Step 2: Create apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@shwp/shared": ["../../packages/shared/src"],
      "@shwp/types": ["../../packages/types/src"],
      "@shwp/auth": ["../../packages/auth/src"],
      "@shwp/config": ["../../packages/config/src"],
      "@shwp/storage": ["../../packages/storage/src"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create apps/api/nest-cli.json**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "plugins": []
  }
}
```

- [ ] **Step 4: Create apps/api/src/health/health.controller.ts**

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

- [ ] **Step 5: Create apps/api/src/health/health.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 6: Create apps/api/src/app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [HealthModule],
})
export class AppModule {}
```

- [ ] **Step 7: Create apps/api/src/main.ts**

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { parseApiEnv } from '@shwp/config';

async function bootstrap(): Promise<void> {
  const env = parseApiEnv();
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api/v1');
  await app.listen(env.PORT);
  console.log(`API running on port ${env.PORT}`);
}

bootstrap().catch(err => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
```

- [ ] **Step 8: Install deps and build**

```bash
cd /root/shwp-rec
pnpm install
cd apps/api
pnpm build
```

Expected: NestJS builds to `dist/`. No TypeScript errors.

- [ ] **Step 9: Commit**

```bash
cd /root/shwp-rec
git add apps/api/
git commit -m "feat(api): add NestJS skeleton with health endpoint"
```

---

## Task 8: apps/worker — BullMQ worker skeleton

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/main.ts`
- Create: `apps/worker/src/processors/processing.processor.ts`

- [ ] **Step 1: Create apps/worker/package.json**

```json
{
  "name": "@shwp/worker",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "tsc",
    "dev": "ts-node --esm src/main.ts",
    "typecheck": "tsc --noEmit",
    "test": "jest --passWithNoTests"
  },
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0",
    "@shwp/config": "workspace:*",
    "@shwp/shared": "workspace:*",
    "@shwp/storage": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "*"
  }
}
```

- [ ] **Step 2: Create apps/worker/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@shwp/shared": ["../../packages/shared/src"],
      "@shwp/config": ["../../packages/config/src"],
      "@shwp/storage": ["../../packages/storage/src"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create apps/worker/src/processors/processing.processor.ts**

```typescript
import { Worker, type Job } from 'bullmq';
import { QUEUE_NAMES, JobType } from '@shwp/shared';
import type IORedis from 'ioredis';

export interface ProcessingJobData {
  videoId: string;
  type: JobType;
  sourceKey: string;
}

export function createProcessingWorker(connection: IORedis): Worker<ProcessingJobData> {
  return new Worker<ProcessingJobData>(
    QUEUE_NAMES.PROCESSING,
    async (job: Job<ProcessingJobData>) => {
      console.log(`[worker] Processing job ${job.id} type=${job.data.type} videoId=${job.data.videoId}`);
      // Phase 6 implements each job type. For now we just acknowledge.
      throw new Error(`Job type ${job.data.type} not yet implemented — Phase 6`);
    },
    {
      connection,
      concurrency: 2,
    },
  );
}
```

- [ ] **Step 4: Create apps/worker/src/main.ts**

```typescript
import IORedis from 'ioredis';
import { parseWorkerEnv } from '@shwp/config';
import { createProcessingWorker } from './processors/processing.processor.js';

async function bootstrap(): Promise<void> {
  const env = parseWorkerEnv();

  const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  redis.on('connect', () => console.log('[worker] Redis connected'));
  redis.on('error', err => console.error('[worker] Redis error:', err));

  const processingWorker = createProcessingWorker(redis);

  processingWorker.on('completed', job => console.log(`[worker] Job ${job.id} completed`));
  processingWorker.on('failed', (job, err) => console.error(`[worker] Job ${job?.id} failed:`, err.message));

  console.log('[worker] Worker started. Waiting for jobs...');

  async function shutdown(): Promise<void> {
    console.log('[worker] Shutting down...');
    await processingWorker.close();
    redis.disconnect();
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch(err => {
  console.error('[worker] Failed to start:', err);
  process.exit(1);
});
```

- [ ] **Step 5: Build**

```bash
cd /root/shwp-rec
pnpm install
cd apps/worker
pnpm build
```

Expected: `dist/` created with compiled JS. No TS errors.

- [ ] **Step 6: Commit**

```bash
cd /root/shwp-rec
git add apps/worker/
git commit -m "feat(worker): add BullMQ worker skeleton with processing queue consumer"
```

---

## Task 9: apps/recorder — TypeScript skeleton

**Files:**
- Create: `apps/recorder/package.json`
- Create: `apps/recorder/tsconfig.json`
- Create: `apps/recorder/src/types.ts`
- Create: `apps/recorder/src/recorder.ts`
- Create: `apps/recorder/src/main.ts`

- [ ] **Step 1: Create apps/recorder/package.json**

```json
{
  "name": "@shwp/recorder",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "tsc",
    "dev": "node dist/main.js",
    "typecheck": "tsc --noEmit",
    "test": "jest --passWithNoTests"
  },
  "dependencies": {
    "playwright-extra": "^4.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "js-yaml": "^4.1.0",
    "mkdirp": "^3.0.0",
    "@shwp/config": "workspace:*",
    "@shwp/shared": "workspace:*",
    "@shwp/auth": "workspace:*"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@types/js-yaml": "^4.0.0",
    "@types/node": "^20.0.0",
    "typescript": "*"
  }
}
```

- [ ] **Step 2: Create apps/recorder/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@shwp/shared": ["../../packages/shared/src"],
      "@shwp/config": ["../../packages/config/src"],
      "@shwp/auth": ["../../packages/auth/src"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create apps/recorder/src/types.ts**

```typescript
import type { Page } from 'playwright-extra';

export interface OnlineModel {
  uid: string;
  username: string;
  aliasStreamKey: string | null;
}

export interface ActiveCapture {
  uid: string;
  model: string;
  filename: string;
  page: Page;
  startedAt: number;
  lastChunkTime: number;
  size: number;
  checkAfter: number;
}

export interface RecorderConfig {
  captureDirectory: string;
  completeDirectory: string;
  modelScanIntervalSec: number;
  minFileSizeMb: number;
  maxConcurrentRecordings: number;
  debug: boolean;
}
```

- [ ] **Step 4: Create apps/recorder/src/recorder.ts**

```typescript
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createWriteStream, statSync, unlinkSync } from 'fs';
import { mkdirp } from 'mkdirp';
import { join } from 'path';
import type { Browser, Page } from 'playwright-extra';
import type { ActiveCapture, OnlineModel, RecorderConfig } from './types.js';

chromium.use(stealth());

export class RecorderService {
  private browser: Browser | null = null;
  private mainPage: Page | null = null;
  private captures: ActiveCapture[] = [];
  private onlineFemales = new Map<string, OnlineModel>();

  constructor(private readonly config: RecorderConfig) {}

  async start(): Promise<void> {
    await mkdirp(this.config.captureDirectory);
    await mkdirp(this.config.completeDirectory);
    this.browser = await chromium.launch({ headless: true });
    this.mainPage = await this.browser.newPage();
    this.attachAppWsListener(this.mainPage);
    await this.refreshMainPage();
    await this.runLoop();
  }

  async stop(): Promise<void> {
    console.log(`[recorder] Stopping — finalizing ${this.captures.length} recording(s)...`);
    await Promise.allSettled(this.captures.map(c => this.finalizeCapture(c)));
    await this.browser?.close();
  }

  private async runLoop(): Promise<void> {
    await this.scan();
    setTimeout(() => this.runLoop(), this.config.modelScanIntervalSec * 1000);
  }

  private async scan(): Promise<void> {
    this.onlineFemales.clear();
    await this.refreshMainPage();
    await new Promise(r => setTimeout(r, 10_000));
    const toRecord = [...this.onlineFemales.values()].filter(
      m => !this.isCapturing(m.username),
    );
    for (const m of toRecord.filter(m => m.aliasStreamKey)) {
      await this.startRecording(m).catch(err =>
        console.error(`[recorder][${m.username}]`, err.message),
      );
    }
    await Promise.allSettled(this.captures.map(c => this.healthCheck(c)));
  }

  private isCapturing(username: string): boolean {
    return this.captures.some(c => c.model.toLowerCase() === username.toLowerCase());
  }

  private async startRecording(model: OnlineModel): Promise<void> {
    if (this.isCapturing(model.username)) return;
    if (this.captures.length >= this.config.maxConcurrentRecordings) return;

    const now = Date.now();
    const ts = new Date(now).toISOString().replace(/[:.]/g, '-');
    const filename = `${model.username}_${ts}.mp4`;
    const outPath = join(this.config.captureDirectory, filename);
    const fileStream = createWriteStream(outPath);
    const page = await this.browser!.newPage();

    const capture: ActiveCapture = {
      uid: model.uid,
      model: model.username,
      filename,
      page,
      startedAt: now,
      lastChunkTime: now,
      size: 0,
      checkAfter: now + 60_000,
    };
    this.captures.push(capture);

    page.on('websocket', ws => {
      if (!ws.url().includes('storm')) return;
      ws.on('framereceived', frame => {
        if (typeof frame.payload === 'string') return;
        const buf = Buffer.isBuffer(frame.payload) ? frame.payload : Buffer.from(frame.payload);
        fileStream.write(buf);
        capture.lastChunkTime = Date.now();
        capture.size += buf.length;
      });
    });

    try {
      await page.goto(`https://showup.tv/${encodeURIComponent(model.username)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.click('button:has-text("Wchodzę")', { timeout: 2_000 }).catch(() => {});
    } catch (err) {
      console.error(`[recorder][${model.username}] Navigation failed:`, (err as Error).message);
      await this.finalizeCapture(capture);
    }
  }

  private async finalizeCapture(capture: ActiveCapture): Promise<void> {
    this.captures = this.captures.filter(c => c !== capture);
    try { await capture.page.close(); } catch {}

    const src = join(this.config.captureDirectory, capture.filename);
    await new Promise<void>(resolve => (capture as any).fileStream?.end(resolve) ?? resolve());

    try {
      const { size } = statSync(src);
      const minBytes = this.config.minFileSizeMb * 1_048_576;
      if (size <= minBytes) {
        unlinkSync(src);
        console.log(`[recorder][${capture.model}] File too small (${size} bytes), deleted`);
      } else {
        console.log(`[recorder][${capture.model}] Recording saved (${(size / 1_048_576).toFixed(1)} MB)`);
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') console.error(`[recorder][${capture.model}]`, err.message);
    }
  }

  private async healthCheck(capture: ActiveCapture): Promise<void> {
    if (capture.checkAfter > Date.now()) return;
    const idleSec = (Date.now() - capture.lastChunkTime) / 1000;
    if (idleSec > 90) {
      console.log(`[recorder][${capture.model}] No data for ${Math.round(idleSec)}s — finalizing`);
      await this.finalizeCapture(capture);
    } else {
      capture.checkAfter = Date.now() + 600_000;
    }
  }

  private attachAppWsListener(page: Page): void {
    page.on('websocket', ws => {
      if (!ws.url().includes('/app')) return;
      ws.on('framereceived', frame => {
        if (typeof frame.payload !== 'string') return;
        let msg: any;
        try { msg = JSON.parse(frame.payload); } catch { return; }

        const { packetType, homeListElement, hostUid } = msg;
        const host = homeListElement?.host;
        const broadcast = homeListElement?.broadcast;

        if (packetType === 'PUB_BROADCAST_STARTED' && host?.gender === 'FEMALE') {
          const entry: OnlineModel = {
            uid: host.id,
            username: host.username,
            aliasStreamKey: broadcast?.aliasStreamKey ?? null,
          };
          this.onlineFemales.set(host.id, entry);
          if (!this.isCapturing(host.username)) {
            this.startRecording(entry).catch(err =>
              console.error(`[recorder][${host.username}]`, err.message),
            );
          }
        } else if (packetType === 'PUB_BROADCAST_FINISHED') {
          this.onlineFemales.delete(hostUid);
          const cap = this.captures.find(c => c.uid === hostUid);
          if (cap) {
            setTimeout(() => {
              const still = this.captures.find(c => c.uid === hostUid);
              if (still && Date.now() - still.lastChunkTime > 15_000) {
                this.finalizeCapture(still).catch(() => {});
              }
            }, 10_000);
          }
        }
      });
    });
  }

  private async refreshMainPage(): Promise<void> {
    try {
      await this.mainPage!.goto('https://showup.tv', { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await this.mainPage!.click('button:has-text("Wchodzę")', { timeout: 2_000 }).catch(() => {});
      const content = await this.mainPage!.content();
      const match = content.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
      if (match) {
        const data = JSON.parse(match[1]);
        const list: any[] = data?.props?.pageProps?.homeListData?.list ?? [];
        for (const item of list) {
          if (item.host?.gender === 'FEMALE') {
            this.onlineFemales.set(item.host.id, {
              uid: item.host.id,
              username: item.host.username,
              aliasStreamKey: item.broadcast?.aliasStreamKey ?? null,
            });
          }
        }
      }
    } catch (err) {
      console.error('[recorder] Failed to load main page:', (err as Error).message);
    }
  }
}
```

- [ ] **Step 5: Create apps/recorder/src/main.ts**

```typescript
import { parseRecorderEnv } from '@shwp/config';
import { RecorderService } from './recorder.js';

async function main(): Promise<void> {
  const env = parseRecorderEnv();

  const recorder = new RecorderService({
    captureDirectory: 'captures',
    completeDirectory: 'complete',
    modelScanIntervalSec: env.MODEL_SCAN_INTERVAL_SEC,
    minFileSizeMb: env.MIN_FILE_SIZE_MB,
    maxConcurrentRecordings: env.MAX_CONCURRENT_RECORDINGS,
    debug: env.DEBUG,
  });

  process.on('SIGINT', () => recorder.stop().then(() => process.exit(0)));
  process.on('SIGTERM', () => recorder.stop().then(() => process.exit(0)));

  await recorder.start();
}

main().catch(err => {
  console.error('[recorder] Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 6: Build**

```bash
cd /root/shwp-rec
pnpm install
cd apps/recorder
pnpm build
```

Expected: `dist/` created. No TS errors.

- [ ] **Step 7: Commit**

```bash
cd /root/shwp-rec
git add apps/recorder/
git commit -m "feat(recorder): convert main.js to TypeScript RecorderService class"
```

---

## Task 10: apps/frontend — Next.js 14 skeleton

**Files:**
- Create: `apps/frontend/package.json`
- Create: `apps/frontend/tsconfig.json`
- Create: `apps/frontend/next.config.ts`
- Create: `apps/frontend/tailwind.config.ts`
- Create: `apps/frontend/postcss.config.js`
- Create: `apps/frontend/src/app/layout.tsx`
- Create: `apps/frontend/src/app/page.tsx`

- [ ] **Step 1: Create apps/frontend/package.json**

```json
{
  "name": "@shwp/frontend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "next build",
    "dev": "next dev --port 3000",
    "typecheck": "tsc --noEmit",
    "test": "jest --passWithNoTests"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@shwp/types": "workspace:*",
    "@shwp/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "*"
  }
}
```

- [ ] **Step 2: Create apps/frontend/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@shwp/types": ["../../packages/types/src"],
      "@shwp/shared": ["../../packages/shared/src"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create apps/frontend/next.config.ts**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@shwp/shared', '@shwp/types'],
};

export default nextConfig;
```

- [ ] **Step 4: Create apps/frontend/postcss.config.js**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create apps/frontend/tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Create apps/frontend/src/app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VOD Platform',
  description: 'Video on demand platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create apps/frontend/src/app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Create apps/frontend/src/app/page.tsx**

```tsx
export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">VOD Platform</h1>
        <p className="text-gray-400">Coming soon.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Install and build**

```bash
cd /root/shwp-rec
pnpm install
cd apps/frontend
pnpm build
```

Expected: Next.js builds successfully. No TS errors.

- [ ] **Step 10: Commit**

```bash
cd /root/shwp-rec
git add apps/frontend/
git commit -m "feat(frontend): add Next.js 14 skeleton with Tailwind CSS"
```

---

## Task 11: infra — Docker and docker-compose

**Files:**
- Create: `infra/docker/api.Dockerfile`
- Create: `infra/docker/worker.Dockerfile`
- Create: `infra/docker/recorder.Dockerfile`
- Create: `infra/docker/frontend.Dockerfile`
- Create: `infra/nginx/nginx.conf`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create infra/docker/api.Dockerfile**

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/
COPY packages/auth/package.json ./packages/auth/
COPY packages/storage/package.json ./packages/storage/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @shwp/config build && \
    pnpm --filter @shwp/shared build && \
    pnpm --filter @shwp/types build && \
    pnpm --filter @shwp/auth build && \
    pnpm --filter @shwp/storage build && \
    pnpm --filter @shwp/api build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

- [ ] **Step 2: Create infra/docker/worker.Dockerfile**

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/storage/package.json ./packages/storage/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @shwp/config build && \
    pnpm --filter @shwp/shared build && \
    pnpm --filter @shwp/storage build && \
    pnpm --filter @shwp/worker build

FROM node:20-alpine AS runner
RUN apk add --no-cache ffmpeg
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker
COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/packages ./packages
USER worker
CMD ["node", "dist/main.js"]
```

- [ ] **Step 3: Create infra/docker/recorder.Dockerfile**

```dockerfile
FROM node:20 AS base
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/auth/package.json ./packages/auth/
COPY apps/recorder/package.json ./apps/recorder/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @shwp/config build && \
    pnpm --filter @shwp/shared build && \
    pnpm --filter @shwp/auth build && \
    pnpm --filter @shwp/recorder build

FROM node:20 AS runner
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app
COPY --from=builder /app/apps/recorder/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
RUN npx playwright install chromium --with-deps
CMD ["node", "dist/main.js"]
```

- [ ] **Step 4: Create infra/docker/frontend.Dockerfile**

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/types/package.json ./packages/types/
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @shwp/shared build && \
    pnpm --filter @shwp/types build && \
    pnpm --filter @shwp/frontend build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "apps/frontend/server.js"]
```

- [ ] **Step 5: Create infra/nginx/nginx.conf**

```nginx
upstream api {
    server api:3001;
}

upstream frontend {
    server frontend:3000;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 0;

    location /api/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        limit_req zone=api_limit burst=20 nodelay;
    }

    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
```

- [ ] **Step 6: Create docker-compose.yml**

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: shwp
      POSTGRES_PASSWORD: shwp
      POSTGRES_DB: shwp
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U shwp']
      interval: 5s
      timeout: 5s
      retries: 10
    ports:
      - '5432:5432'

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 10
    ports:
      - '6379:6379'

  api:
    build:
      context: .
      dockerfile: infra/docker/api.Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://shwp:shwp@postgres:5432/shwp
      REDIS_URL: redis://redis:6379
      PORT: 3001
      NODE_ENV: production
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}
      INGEST_SERVICE_SECRET: ${INGEST_SERVICE_SECRET:?INGEST_SERVICE_SECRET is required}
      STORAGE_PROVIDER: ${STORAGE_PROVIDER:-local}
      R2_ACCOUNT_ID: ${R2_ACCOUNT_ID:-}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID:-}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY:-}
      R2_BUCKET_NAME: ${R2_BUCKET_NAME:-shwp-recordings}
      R2_PUBLIC_URL: ${R2_PUBLIC_URL:-}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - '3001:3001'
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://localhost:3001/api/v1/health || exit 1']
      interval: 10s
      timeout: 5s
      retries: 5

  worker:
    build:
      context: .
      dockerfile: infra/docker/worker.Dockerfile
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://shwp:shwp@postgres:5432/shwp
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
      STORAGE_PROVIDER: ${STORAGE_PROVIDER:-local}
      R2_ACCOUNT_ID: ${R2_ACCOUNT_ID:-}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID:-}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY:-}
      R2_BUCKET_NAME: ${R2_BUCKET_NAME:-shwp-recordings}
      FFMPEG_MAX_CONCURRENT: 2
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  recorder:
    build:
      context: .
      dockerfile: infra/docker/recorder.Dockerfile
    restart: unless-stopped
    environment:
      API_URL: http://api:3001/api/v1
      INGEST_SERVICE_SECRET: ${INGEST_SERVICE_SECRET:?INGEST_SERVICE_SECRET is required}
      STORAGE_PROVIDER: ${STORAGE_PROVIDER:-local}
      R2_ACCOUNT_ID: ${R2_ACCOUNT_ID:-}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID:-}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY:-}
      R2_BUCKET_NAME: ${R2_BUCKET_NAME:-shwp-recordings}
    depends_on:
      api:
        condition: service_healthy

  frontend:
    build:
      context: .
      dockerfile: infra/docker/frontend.Dockerfile
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: http://localhost/api
      NODE_ENV: production
    depends_on:
      - api

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - '80:80'
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api
      - frontend

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 7: Commit**

```bash
cd /root/shwp-rec
git add infra/ docker-compose.yml
git commit -m "feat(infra): add Dockerfiles for all apps and docker-compose.yml"
```

---

## Task 12: Workspace-wide build verification

- [ ] **Step 1: Install all dependencies**

```bash
cd /root/shwp-rec
pnpm install
```

Expected: all packages install. No peer dep errors.

- [ ] **Step 2: Build all packages in dependency order**

```bash
cd /root/shwp-rec
pnpm --filter @shwp/config build
pnpm --filter @shwp/shared build
pnpm --filter @shwp/types build
pnpm --filter @shwp/auth build
pnpm --filter @shwp/storage build
```

Expected: each prints "Found 0 errors." — `dist/` created in each.

- [ ] **Step 3: Build all apps**

```bash
pnpm --filter @shwp/api build
pnpm --filter @shwp/worker build
pnpm --filter @shwp/recorder build
```

Expected: all compile. NestJS outputs `dist/main.js`. Worker outputs `dist/main.js`. Recorder outputs `dist/main.js`.

- [ ] **Step 4: Typecheck frontend**

```bash
pnpm --filter @shwp/frontend typecheck
```

Expected: No errors.

- [ ] **Step 5: Run full turbo build**

```bash
cd /root/shwp-rec
pnpm build
```

Expected: Turborepo builds all packages and apps with caching. Output shows all tasks pass.

- [ ] **Step 6: Run full turbo typecheck**

```bash
pnpm typecheck
```

Expected: All packages and apps pass typecheck.

- [ ] **Step 7: Update docs/TODO.md — mark Phase 2 complete**

In `docs/TODO.md`, find Phase 2 and change `🔲 PENDING` to `✅ COMPLETE`.

- [ ] **Step 8: Final commit**

```bash
cd /root/shwp-rec
git add -A
git commit -m "chore: Phase 2 complete — monorepo foundation, all packages and apps build clean"
```
