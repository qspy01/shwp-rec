import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '@/lib/ratelimit';

describe('checkRateLimit', () => {
  it('allows requests within the limit', async () => {
    const key = `test-allow-${Date.now()}`;
    expect(await checkRateLimit(key, 3, 10000)).toBe(true);
    expect(await checkRateLimit(key, 3, 10000)).toBe(true);
    expect(await checkRateLimit(key, 3, 10000)).toBe(true);
  });

  it('blocks after limit is reached', async () => {
    const key = `test-block-${Date.now()}`;
    await checkRateLimit(key, 2, 10000);
    await checkRateLimit(key, 2, 10000);
    expect(await checkRateLimit(key, 2, 10000)).toBe(false);
    expect(await checkRateLimit(key, 2, 10000)).toBe(false);
  });

  it('different keys have independent buckets', async () => {
    const k1 = `test-k1-${Date.now()}`;
    const k2 = `test-k2-${Date.now()}`;
    await checkRateLimit(k1, 1, 10000);
    expect(await checkRateLimit(k1, 1, 10000)).toBe(false);
    expect(await checkRateLimit(k2, 1, 10000)).toBe(true);
  });

  it('resets after window expires', async () => {
    const key = `test-reset-${Date.now()}`;
    await checkRateLimit(key, 1, 10); // 10ms window
    await new Promise<void>((r) => setTimeout(r, 30));
    expect(await checkRateLimit(key, 1, 10)).toBe(true);
  });
});
