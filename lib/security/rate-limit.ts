type Window = { count: number; resetAt: number };

type RateLimitRequest = {
  ip: string;
  scope: string;
  limit: number;
  windowMs: number;
  now?: number;
};

type RateLimiterOptions = {
  globalIpLimit?: number;
  globalIpWindowMs?: number;
  maxIpBuckets?: number;
  maxScopedBuckets?: number;
};

const DEFAULT_GLOBAL_IP_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_BUCKETS = 10_000;

function evictExpiredOrOldest(
  buckets: Map<string, Window>,
  now: number,
  maxBuckets: number
) {
  if (buckets.size < maxBuckets) return;

  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }

  if (buckets.size < maxBuckets) return;
  const oldestKey = buckets.keys().next().value;
  if (oldestKey !== undefined) buckets.delete(oldestKey);
}

function consume(
  buckets: Map<string, Window>,
  key: string,
  limit: number,
  windowMs: number,
  maxBuckets: number,
  now: number
) {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (existing) buckets.delete(key);
    evictExpiredOrOldest(buckets, now, maxBuckets);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  existing.count += 1;
  // Refresh insertion order so capacity eviction removes the least recently
  // used active bucket, not an IP or scope that is still sending requests.
  buckets.delete(key);
  buckets.set(key, existing);
  return existing.count > limit;
}

// Pure helper: imported only by server call sites, but kept free of
// `server-only` so the limiter logic can be unit-tested in Vitest. State is
// local to one server instance and resets on restart, so this remains a
// best-effort guard rather than a distributed rate limit.
export function createRateLimiter({
  globalIpLimit = DEFAULT_GLOBAL_IP_LIMIT,
  globalIpWindowMs = DEFAULT_WINDOW_MS,
  maxIpBuckets = DEFAULT_MAX_BUCKETS,
  maxScopedBuckets = DEFAULT_MAX_BUCKETS,
}: RateLimiterOptions = {}) {
  const ipBuckets = new Map<string, Window>();
  const scopedBuckets = new Map<string, Window>();

  return ({
    ip,
    scope,
    limit,
    windowMs,
    now = Date.now(),
  }: RateLimitRequest): boolean => {
    const ipLimited = consume(
      ipBuckets,
      ip,
      globalIpLimit,
      globalIpWindowMs,
      maxIpBuckets,
      now
    );
    if (ipLimited) return true;

    return consume(
      scopedBuckets,
      JSON.stringify([ip, scope]),
      limit,
      windowMs,
      maxScopedBuckets,
      now
    );
  };
}

export const isRateLimited = createRateLimiter();

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const [first] = forwarded.split(',');
    const ip = first?.trim();
    if (ip) return ip;
  }
  return headers.get('x-real-ip') ?? 'unknown';
}
