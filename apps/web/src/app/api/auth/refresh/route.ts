import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@shwp-rec/db';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from '@/lib/auth';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export async function POST(req: NextRequest) {
  const rawToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!rawToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const tokenHash = hashRefreshToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    // Clear cookies on invalid token
    const res = NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
    res.cookies.delete(ACCESS_TOKEN_COOKIE);
    res.cookies.delete(REFRESH_TOKEN_COOKIE);
    return res;
  }

  // Rotate: revoke old token, issue new one
  const newRawRefresh = generateRefreshToken();
  const [accessToken] = await Promise.all([
    signAccessToken({ sub: stored.user.id, email: stored.user.email, role: stored.user.role }),
    prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          userId: stored.user.id,
          tokenHash: hashRefreshToken(newRawRefresh),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
        },
      }),
    ]),
  ]);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookies.set(REFRESH_TOKEN_COOKIE, newRawRefresh, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
  return res;
}
