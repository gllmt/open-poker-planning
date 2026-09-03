'use server';

import { createHmac } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { i18n, isLocale, LOCALE_COOKIE_NAME } from '@/lib/i18n/config';
import { getClientIp, isRateLimited } from '@/lib/security/rate-limit';
import { sanitizeInternalPath } from '@/lib/security/safe-redirect';
import { generateToken, safeEqual } from '@/lib/security/tokens';

const ACCESS_COOKIE_NAME = 'pp_site_access';
const ACCESS_COOKIE_VERSION = 'v1';
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export async function submitAccessCode(formData: FormData) {
  const secret = process.env.SITE_ACCESS_CODE;
  const nextPath = sanitizeInternalPath(formData.get('next'));
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : i18n.defaultLocale;

  // If not configured, the gate is disabled.
  if (!secret) redirect(nextPath);

  const errorPath = `/${locale}/access?error=1&next=${encodeURIComponent(nextPath)}`;
  const ip = getClientIp(await headers());
  if (
    isRateLimited({
      ip,
      scope: 'access-code',
      limit: 5,
      windowMs: 60_000,
    })
  ) {
    redirect(errorPath);
  }

  const codeValue = formData.get('code');
  const code = typeof codeValue === 'string' ? codeValue : '';
  if (!code || !safeEqual(code, secret)) {
    redirect(errorPath);
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = generateToken(16);
  const payload = `${ACCESS_COOKIE_VERSION}.${issuedAt}.${nonce}`;
  const signature = sign(payload, secret);

  cookieStore.set(ACCESS_COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
  });

  redirect(nextPath);
}
