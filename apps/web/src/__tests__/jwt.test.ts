import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-32-bytes-long-enough-here';
});

const { signAccessToken, verifyAccessToken } = await import('@/lib/jwt');

describe('JWT sign/verify round-trip', () => {
  it('signs and verifies an ADMIN token', async () => {
    const payload = { sub: 'user-1', email: 'admin@example.com', role: 'ADMIN' as const };
    const token = await signAccessToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const verified = await verifyAccessToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe('user-1');
    expect(verified?.email).toBe('admin@example.com');
    expect(verified?.role).toBe('ADMIN');
  });

  it('signs and verifies a VIEWER token', async () => {
    const token = await signAccessToken({ sub: 'user-2', email: 'viewer@example.com', role: 'VIEWER' });
    const verified = await verifyAccessToken(token);
    expect(verified?.role).toBe('VIEWER');
  });

  it('returns null for a tampered token', async () => {
    const token = await signAccessToken({ sub: 'u', email: 'x@x.com', role: 'ADMIN' });
    const [header, , sig] = token.split('.');
    const tampered = `${header}.eyJzdWIiOiJoYWNrZWQifQ.${sig}`;
    const result = await verifyAccessToken(tampered);
    expect(result).toBeNull();
  });

  it('returns null for a garbage string', async () => {
    expect(await verifyAccessToken('not.a.token')).toBeNull();
  });

  it('returns null for empty string', async () => {
    expect(await verifyAccessToken('')).toBeNull();
  });
});
