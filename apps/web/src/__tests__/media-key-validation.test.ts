import { describe, it, expect } from 'vitest';

// Test the key validation logic in isolation — no need to import the Next.js route
const SAFE_KEY_RE = /^[a-zA-Z0-9_\-/. ]+$/;

function isValidKey(key: string): boolean {
  return SAFE_KEY_RE.test(key) && !key.includes('..');
}

describe('media proxy key validation', () => {
  it('accepts a plain MP4 key', () => {
    expect(isValidKey('username/streamid.mp4')).toBe(true);
  });

  it('accepts a UUID-based path', () => {
    expect(isValidKey('alice/550e8400-e29b-41d4-a716-446655440000.mp4')).toBe(true);
  });

  it('accepts HLS manifest key', () => {
    expect(isValidKey('alice/550e8400/550e8400.m3u8')).toBe(true);
  });

  it('accepts HLS segment key', () => {
    expect(isValidKey('alice/550e8400/550e8400_0000.ts')).toBe(true);
  });

  it('accepts thumbnail key', () => {
    expect(isValidKey('alice/stream.jpg')).toBe(true);
  });

  it('rejects path traversal with ..', () => {
    expect(isValidKey('../etc/passwd')).toBe(false);
    expect(isValidKey('alice/../../secret')).toBe(false);
    expect(isValidKey('alice/..%2F..%2Fetc')).toBe(false);
  });

  it('rejects keys with null bytes', () => {
    expect(isValidKey('alice/\x00secret')).toBe(false);
  });

  it('rejects keys with shell metacharacters', () => {
    expect(isValidKey('alice/$(whoami)')).toBe(false);
    expect(isValidKey('alice/`id`')).toBe(false);
    expect(isValidKey('alice/file;rm -rf /')).toBe(false);
  });

  it('rejects empty key', () => {
    expect(isValidKey('')).toBe(false);
  });

  it('rejects keys with encoded slashes that bypass the regex', () => {
    // %2F is not a raw slash — regex won't match %
    expect(isValidKey('alice%2F..%2Fsecret')).toBe(false);
  });
});
