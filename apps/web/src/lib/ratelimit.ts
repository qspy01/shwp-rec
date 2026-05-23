import { randomUUID } from 'crypto';

// In-memory fallback (used when Redis is unavailable)
interface Bucket { count: number; resetAt: number; }
const localStore = new Map<string, Bucket>();
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of localStore.entries()) if (now > b.resetAt) localStore.delete(k);
}, 5 * 60 * 1000).unref();

function localCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = localStore.get(key);
  if (!b || now > b.resetAt) { localStore.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

// Lazy Redis singleton — fails open if Redis is down
let _redis: import('ioredis').Redis | undefined;
function getRedis(): import('ioredis').Redis | undefined {
  if (_redis) return _redis;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require('ioredis') as { Redis: typeof import('ioredis').Redis };
    _redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6385),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
  } catch {
    // ioredis unavailable — in-memory fallback
  }
  return _redis;
}

/**
 * Sliding-window rate limit via Redis sorted sets.
 * Falls back to per-process in-memory counter if Redis is unavailable.
 * Returns true if the request is allowed.
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return localCheck(key, limit, windowMs);

  try {
    const now = Date.now();
    const windowStart = now - windowMs;
    const fullKey = `rl:${key}`;
    const member = `${now}-${randomUUID()}`;

    const results = await redis
      .pipeline()
      .zremrangebyscore(fullKey, 0, windowStart)
      .zadd(fullKey, now, member)
      .zcard(fullKey)
      .pexpire(fullKey, windowMs)
      .exec();

    // Null results mean the pipeline was aborted (connection issue) — fall back
    if (!results) return localCheck(key, limit, windowMs);
    // Each tuple is [error, value]; if zcard errored, fall back
    const [zcardErr, zcardVal] = results[2] as [Error | null, number | null];
    if (zcardErr) return localCheck(key, limit, windowMs);
    return (zcardVal ?? 0) <= limit;
  } catch {
    return localCheck(key, limit, windowMs);
  }
}
