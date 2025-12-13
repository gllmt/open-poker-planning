'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac } from 'node:crypto';

import { generateToken, safeEqual } from '@/lib/security/tokens';

const ACCESS_COOKIE_NAME = 'pp_site_access';
const ACCESS_COOKIE_VERSION = 'v1';
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function sanitizeNext(raw: unknown): string {
  if (typeof raw !== 'string') return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export async function submitAccessCode(formData: FormData) {
  const secret = process.env.SITE_ACCESS_CODE;
  const nextPath = sanitizeNext(formData.get('next'));

  // If not configured, the gate is disabled.
  if (!secret) redirect(nextPath);

  const codeValue = formData.get('code');
  const code = typeof codeValue === 'string' ? codeValue : '';
  if (!code || !safeEqual(code, secret)) {
    redirect(`/access?error=1&next=${encodeURIComponent(nextPath)}`);
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = generateToken(16);
  const payload = `${ACCESS_COOKIE_VERSION}.${issuedAt}.${nonce}`;
  const signature = sign(payload, secret);

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
  });

  redirect(nextPath);
}
