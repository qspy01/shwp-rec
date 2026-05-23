import { SignJWT, jwtVerify } from 'jose';

export interface JwtPayload {
  sub: string;   // userId
  email: string;
  role: 'ADMIN' | 'VIEWER';
}

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET environment variable is required');
  if (s.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  return new TextEncoder().encode(s);
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      (payload.role !== 'ADMIN' && payload.role !== 'VIEWER')
    ) {
      return null;
    }
    return { sub: payload.sub, email: payload.email as string, role: payload.role };
  } catch {
    return null;
  }
}
