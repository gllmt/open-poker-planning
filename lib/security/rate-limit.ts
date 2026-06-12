// Pure helper: imported only by server call sites, but kept free of
// `server-only` so the limiter logic can be unit-tested in Vitest.
type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();
const MAX_BUCKETS = 10_000;

export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): boolean {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [bucketKey, window] of buckets) {
        if (window.resetAt <= now) buckets.delete(bucketKey);
      }
      if (buckets.size >= MAX_BUCKETS) return false;
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  existing.count += 1;
  return existing.count > limit;
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const [first] = forwarded.split(',');
    const ip = first?.trim();
    if (ip) return ip;
  }
  return headers.get('x-real-ip') ?? 'unknown';
}
