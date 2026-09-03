import { describe, expect, it } from 'vitest';

import { createRateLimiter, getClientIp } from '@/lib/security/rate-limit';

describe('createRateLimiter', () => {
  it('allows requests up to the configured limit', () => {
    const isRateLimited = createRateLimiter();
    const request = {
      ip: '203.0.113.1',
      scope: 'under-limit',
      limit: 3,
      windowMs: 60_000,
    };

    expect(isRateLimited({ ...request, now: 1_000 })).toBe(false);
    expect(isRateLimited({ ...request, now: 1_100 })).toBe(false);
    expect(isRateLimited({ ...request, now: 1_200 })).toBe(false);
  });

  it('blocks the first request over the limit in the same window', () => {
    const isRateLimited = createRateLimiter();
    const request = {
      ip: '203.0.113.2',
      scope: 'over-limit',
      limit: 2,
      windowMs: 60_000,
    };

    expect(isRateLimited({ ...request, now: 2_000 })).toBe(false);
    expect(isRateLimited({ ...request, now: 2_100 })).toBe(false);
    expect(isRateLimited({ ...request, now: 2_200 })).toBe(true);
  });

  it('resets after the window expires', () => {
    const isRateLimited = createRateLimiter();
    const request = {
      ip: '203.0.113.3',
      scope: 'window-reset',
      limit: 1,
      windowMs: 1_000,
    };

    expect(isRateLimited({ ...request, now: 3_000 })).toBe(false);
    expect(isRateLimited({ ...request, now: 3_500 })).toBe(true);
    expect(isRateLimited({ ...request, now: 4_001 })).toBe(false);
  });

  it('keeps independent buckets separate', () => {
    const isRateLimited = createRateLimiter();
    const base = {
      ip: '203.0.113.4',
      limit: 1,
      windowMs: 60_000,
      now: 5_000,
    };

    expect(isRateLimited({ ...base, scope: 'bucket-a' })).toBe(false);
    expect(isRateLimited({ ...base, scope: 'bucket-a' })).toBe(true);
    expect(isRateLimited({ ...base, scope: 'bucket-b' })).toBe(false);
  });

  it('counts fine-bucket rejections toward the global IP limit', () => {
    const isRateLimited = createRateLimiter({ globalIpLimit: 2 });
    const base = {
      ip: '203.0.113.5',
      limit: 1,
      windowMs: 60_000,
      now: 6_000,
    };

    expect(isRateLimited({ ...base, scope: 'bucket-a' })).toBe(false);
    expect(isRateLimited({ ...base, scope: 'bucket-a' })).toBe(true);
    expect(isRateLimited({ ...base, scope: 'bucket-b' })).toBe(true);
  });

  it('keeps the IP bucket intact while scoped buckets are evicted', () => {
    const isRateLimited = createRateLimiter({
      globalIpLimit: 2,
      maxIpBuckets: 1,
      maxScopedBuckets: 1,
    });
    const base = {
      ip: '203.0.113.6',
      limit: 10,
      windowMs: 60_000,
      now: 7_000,
    };

    expect(isRateLimited({ ...base, scope: 'bucket-a' })).toBe(false);
    expect(isRateLimited({ ...base, scope: 'bucket-b' })).toBe(false);
    expect(isRateLimited({ ...base, scope: 'bucket-c' })).toBe(true);
  });

  it('creates a real bucket after capacity eviction instead of failing open', () => {
    const isRateLimited = createRateLimiter({
      globalIpLimit: 10,
      maxScopedBuckets: 1,
    });
    const base = {
      ip: '203.0.113.7',
      limit: 1,
      windowMs: 60_000,
      now: 8_000,
    };

    expect(isRateLimited({ ...base, scope: 'bucket-a' })).toBe(false);
    expect(isRateLimited({ ...base, scope: 'bucket-a' })).toBe(true);
    expect(isRateLimited({ ...base, scope: 'bucket-b' })).toBe(false);
    expect(isRateLimited({ ...base, scope: 'bucket-b' })).toBe(true);
  });

  it('blocks the 61st scoped request from one IP with the default global limit', () => {
    const isRateLimited = createRateLimiter({ maxScopedBuckets: 1 });
    const request = {
      ip: '203.0.113.8',
      limit: 20,
      windowMs: 60_000,
      now: 9_000,
    };

    for (let index = 0; index < 60; index += 1) {
      const gameId = `00000000-0000-4000-8000-${index
        .toString(16)
        .padStart(12, '0')}`;
      expect(isRateLimited({ ...request, scope: `join-game:${gameId}` })).toBe(
        false
      );
    }

    expect(
      isRateLimited({
        ...request,
        scope: 'join-game:00000000-0000-4000-8000-00000000003c',
      })
    ).toBe(true);
  });

  it('removes expired buckets before evicting an active bucket', () => {
    const isRateLimited = createRateLimiter({
      globalIpLimit: 10,
      maxScopedBuckets: 2,
    });
    const request = {
      ip: '203.0.113.9',
      limit: 1,
    };

    expect(
      isRateLimited({
        ...request,
        scope: 'active-oldest',
        windowMs: 10_000,
        now: 10_000,
      })
    ).toBe(false);
    expect(
      isRateLimited({
        ...request,
        scope: 'expired-newer',
        windowMs: 100,
        now: 10_100,
      })
    ).toBe(false);
    expect(
      isRateLimited({
        ...request,
        scope: 'new-bucket',
        windowMs: 10_000,
        now: 10_201,
      })
    ).toBe(false);
    expect(
      isRateLimited({
        ...request,
        scope: 'active-oldest',
        windowMs: 10_000,
        now: 10_202,
      })
    ).toBe(true);
    // The previous hit refreshed active-oldest. At capacity, adding one more
    // bucket must evict new-bucket, whose next request starts a fresh window.
    expect(
      isRateLimited({
        ...request,
        scope: 'newest-bucket',
        windowMs: 10_000,
        now: 10_203,
      })
    ).toBe(false);
    expect(
      isRateLimited({
        ...request,
        scope: 'new-bucket',
        windowMs: 10_000,
        now: 10_204,
      })
    ).toBe(false);
  });
});

describe('getClientIp', () => {
  it('uses the first forwarded IP', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.10, 198.51.100.2',
      'x-real-ip': '192.0.2.1',
    });

    expect(getClientIp(headers)).toBe('203.0.113.10');
  });

  it('falls back to x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': '192.0.2.1' });

    expect(getClientIp(headers)).toBe('192.0.2.1');
  });

  it('falls back to unknown', () => {
    expect(getClientIp(new Headers())).toBe('unknown');
  });
});
