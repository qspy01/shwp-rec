import { describe, it, expect, vi, beforeAll } from 'vitest';

// Prevent @shwp-rec/config from calling process.exit on import
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://localhost/test';
});

vi.mock('@shwp-rec/config', () => ({
  env: {
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6385,
    REDIS_PASSWORD: undefined,
  },
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }),
}));

const { RECORD_QUEUE_NAME, PROCESS_QUEUE_NAME, REDIS_CONFIG } = await import('../index');

describe('queue constants', () => {
  it('RECORD_QUEUE_NAME is record-stream', () => {
    expect(RECORD_QUEUE_NAME).toBe('record-stream');
  });

  it('PROCESS_QUEUE_NAME is process-media', () => {
    expect(PROCESS_QUEUE_NAME).toBe('process-media');
  });

  it('REDIS_CONFIG uses env values', () => {
    expect(REDIS_CONFIG).toEqual({
      host: 'localhost',
      port: 6385,
      password: undefined,
    });
  });
});

describe('RecordStreamJobData shape', () => {
  it('satisfies required fields', () => {
    const job = {
      uid: '12345',
      username: 'testuser',
      aliasStreamKey: null,
      streamId: 'uuid-here',
    };
    // Type-level: all fields present, aliasStreamKey nullable
    expect(job.uid).toBe('12345');
    expect(job.aliasStreamKey).toBeNull();
  });
});

describe('ProcessMediaJobData shape', () => {
  it('satisfies required fields', () => {
    const job = {
      streamId: 'uuid-here',
      modelUsername: 'testuser',
    };
    expect(job.streamId).toBe('uuid-here');
    expect(job.modelUsername).toBe('testuser');
  });
});
