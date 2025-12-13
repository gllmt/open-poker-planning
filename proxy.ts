import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

const ACCESS_COOKIE_NAME = 'pp_site_access';
const ACCESS_COOKIE_VERSION = 'v1';
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function isValidAccessCookie(value: string, secret: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;

  const [version, issuedAtRaw, nonce, signature] = parts;
  if (version !== ACCESS_COOKIE_VERSION) return false;
  if (!issuedAtRaw || !nonce || !signature) return false;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (now < issuedAt) return false;
  if (now - issuedAt > ACCESS_COOKIE_MAX_AGE_SECONDS) return false;

  const payload = `${version}.${issuedAtRaw}.${nonce}`;
  const expectedSignature = sign(payload, secret);
  return safeEqual(signature, expectedSignature);
}

function isPublicPath(pathname: string): boolean {
  return pathname === '/access' || pathname.startsWith('/access/');
}

export function proxy(request: NextRequest) {
  const secret = process.env.SITE_ACCESS_CODE;

  // Gate disabled if not configured.
  if (!secret) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const cookieValue = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (cookieValue && isValidAccessCookie(cookieValue, secret)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/access';
  url.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};

