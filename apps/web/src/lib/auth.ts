import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';

export { signAccessToken, verifyAccessToken } from './jwt';
export type { JwtPayload } from './jwt';
export { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_MAX_AGE, REFRESH_TOKEN_MAX_AGE } from './cookies';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
