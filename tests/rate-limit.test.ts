import { describe, expect, it } from 'vitest';

import { getClientIp, isRateLimited } from '@/lib/security/rate-limit';

describe('isRateLimited', () => {
  it('allows requests up to the configured limit', () => {
    const key = 'under-limit';

    expect(isRateLimited(key, 3, 60_000, 1_000)).toBe(false);
    expect(isRateLimited(key, 3, 60_000, 1_100)).toBe(false);
    expect(isRateLimited(key, 3, 60_000, 1_200)).toBe(false);
  });

  it('blocks the first request over the limit in the same window', () => {
    const key = 'over-limit';

    expect(isRateLimited(key, 2, 60_000, 2_000)).toBe(false);
    expect(isRateLimited(key, 2, 60_000, 2_100)).toBe(false);
    expect(isRateLimited(key, 2, 60_000, 2_200)).toBe(true);
  });

  it('resets after the window expires', () => {
    const key = 'window-reset';

    expect(isRateLimited(key, 1, 1_000, 3_000)).toBe(false);
    expect(isRateLimited(key, 1, 1_000, 3_500)).toBe(true);
    expect(isRateLimited(key, 1, 1_000, 4_001)).toBe(false);
  });

  it('keeps independent buckets separate', () => {
    expect(isRateLimited('bucket-a', 1, 60_000, 5_000)).toBe(false);
    expect(isRateLimited('bucket-a', 1, 60_000, 5_100)).toBe(true);
    expect(isRateLimited('bucket-b', 1, 60_000, 5_100)).toBe(false);
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
