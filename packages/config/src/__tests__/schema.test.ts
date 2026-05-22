import { describe, it, expect } from 'vitest';
import { envSchema } from '../schema';

describe('envSchema', () => {
  const base = { DATABASE_URL: 'postgresql://localhost/test' };

  it('accepts valid minimal env', () => {
    const result = envSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.REDIS_HOST).toBe('localhost');
      expect(result.data.REDIS_PORT).toBe(6385);
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.WORKER_CONCURRENCY).toBe(2);
    }
  });

  it('rejects missing DATABASE_URL', () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toHaveProperty('DATABASE_URL');
    }
  });

  it('rejects empty DATABASE_URL', () => {
    const result = envSchema.safeParse({ DATABASE_URL: '' });
    expect(result.success).toBe(false);
  });

  it('coerces REDIS_PORT from string', () => {
    const result = envSchema.safeParse({ ...base, REDIS_PORT: '6380' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.REDIS_PORT).toBe(6380);
    }
  });

  it('rejects non-numeric REDIS_PORT', () => {
    const result = envSchema.safeParse({ ...base, REDIS_PORT: 'abc' });
    expect(result.success).toBe(false);
  });

  it('accepts only valid NODE_ENV values', () => {
    for (const valid of ['production', 'development', 'test'] as const) {
      expect(envSchema.safeParse({ ...base, NODE_ENV: valid }).success).toBe(true);
    }
    expect(envSchema.safeParse({ ...base, NODE_ENV: 'staging' }).success).toBe(false);
  });

  it('coerces WORKER_CONCURRENCY from string', () => {
    const result = envSchema.safeParse({ ...base, WORKER_CONCURRENCY: '4' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.WORKER_CONCURRENCY).toBe(4);
    }
  });

  it('REDIS_PASSWORD is optional', () => {
    const withPassword = envSchema.safeParse({ ...base, REDIS_PASSWORD: 'secret' });
    const withoutPassword = envSchema.safeParse(base);
    expect(withPassword.success).toBe(true);
    expect(withoutPassword.success).toBe(true);
  });
});
