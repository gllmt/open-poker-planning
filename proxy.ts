import { createHmac, timingSafeEqual } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';

import {
  i18n,
  isLocale,
  LOCALE_COOKIE_NAME,
  type Locale,
} from '@/lib/i18n/config';

const ACCESS_COOKIE_NAME = 'pp_site_access';
const ACCESS_COOKIE_VERSION = 'v1';
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PUBLIC_FILE = /\.(.*)$/;

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

function parseAcceptLanguage(value: string): string[] {
  return value
    .split(',')
    .map((part) => {
      const [localePart, qualityPart] = part.trim().split(';q=');
      const quality = Number(qualityPart ?? '1');
      return {
        locale: localePart.toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.locale);
}

function resolveLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const header = request.headers.get('accept-language');
  if (!header) return i18n.defaultLocale;

  const acceptedLocales = parseAcceptLanguage(header);
  for (const entry of acceptedLocales) {
    const base = entry.split('-')[0];
    if (isLocale(base)) return base;
  }

  return i18n.defaultLocale;
}

function getLocaleFromPathname(pathname: string): Locale | null {
  const segment = pathname.split('/')[1];
  return isLocale(segment) ? segment : null;
}

function isPublicPath(pathname: string): boolean {
  if (pathname === '/access' || pathname.startsWith('/access/')) return true;
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return false;
  const localizedPath = pathname.slice(locale.length + 1);
  return localizedPath === '/access' || localizedPath.startsWith('/access/');
}

function setLocaleCookie(response: NextResponse, locale: Locale) {
  response.cookies.set(LOCALE_COOKIE_NAME, locale, { path: '/' });
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/_next') || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.SITE_ACCESS_CODE;
  const cookieValue = request.cookies.get(ACCESS_COOKIE_NAME)?.value;

  if (pathname.startsWith('/api')) {
    if (!secret || (cookieValue && isValidAccessCookie(cookieValue, secret))) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pathnameLocale = getLocaleFromPathname(pathname);
  if (!pathnameLocale) {
    const locale = resolveLocale(request);
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    return setLocaleCookie(NextResponse.redirect(nextUrl), locale);
  }

  const nextResponse = setLocaleCookie(NextResponse.next(), pathnameLocale);

  if (!secret || isPublicPath(pathname)) return nextResponse;

  if (cookieValue && isValidAccessCookie(cookieValue, secret)) {
    return nextResponse;
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${pathnameLocale}/access`;
  url.searchParams.set('next', `${pathname}${search}`);
  return setLocaleCookie(NextResponse.redirect(url), pathnameLocale);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json).*)',
  ],
};
