import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/jwt';
import { ACCESS_TOKEN_COOKIE } from '@/lib/cookies';

const ADMIN_PREFIXES = ['/admin'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requiresAdmin = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  if (!requiresAdmin) return NextResponse.next();

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyAccessToken(token);
  if (!payload || payload.role !== 'ADMIN') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const headers = new Headers(request.headers);
  headers.set('x-user-id', payload.sub);
  headers.set('x-user-role', payload.role);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/admin/:path*'],
};
