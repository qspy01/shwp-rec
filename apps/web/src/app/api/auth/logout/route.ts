import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@shwp-rec/db';
import {
  hashRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  const rawToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (rawToken) {
    const tokenHash = hashRefreshToken(rawToken);
    await prisma.refreshToken
      .update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      })
      .catch(() => {
        // Token may not exist (already expired/deleted) — silently ignore
      });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
  res.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/api/auth' });
  return res;
}
