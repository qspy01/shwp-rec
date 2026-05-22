import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '@/lib/ratelimit';

describe('checkRateLimit', () => {
  it('allows requests within the limit', () => {
    const key = `test-allow-${Date.now()}`;
    expect(checkRateLimit(key, 3, 10000)).toBe(true);
    expect(checkRateLimit(key, 3, 10000)).toBe(true);
    expect(checkRateLimit(key, 3, 10000)).toBe(true);
  });

  it('blocks after limit is reached', () => {
    const key = `test-block-${Date.now()}`;
    checkRateLimit(key, 2, 10000);
    checkRateLimit(key, 2, 10000);
    expect(checkRateLimit(key, 2, 10000)).toBe(false);
    expect(checkRateLimit(key, 2, 10000)).toBe(false);
  });

  it('different keys have independent buckets', () => {
    const k1 = `test-k1-${Date.now()}`;
    const k2 = `test-k2-${Date.now()}`;
    checkRateLimit(k1, 1, 10000);
    // k1 exhausted, k2 fresh
    expect(checkRateLimit(k1, 1, 10000)).toBe(false);
    expect(checkRateLimit(k2, 1, 10000)).toBe(true);
  });

  it('resets after window expires', async () => {
    const key = `test-reset-${Date.now()}`;
    checkRateLimit(key, 1, 10); // 10ms window
    await new Promise<void>((r) => setTimeout(r, 30));
    expect(checkRateLimit(key, 1, 10)).toBe(true);
  });
});
