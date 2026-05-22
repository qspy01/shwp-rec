interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Purge expired buckets every 5 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store.entries()) {
    if (now > bucket.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}
