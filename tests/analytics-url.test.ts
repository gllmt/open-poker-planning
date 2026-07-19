import { describe, expect, it } from 'vitest';

import {
  getAnalyticsPageviewUrl,
  POSTHOG_URL_PRIVACY_OPTIONS,
} from '@/lib/analytics-url';

describe('getAnalyticsPageviewUrl', () => {
  it('removes query parameters and fragments from pageview URLs', () => {
    expect(
      getAnalyticsPageviewUrl(
        'https://poker.example/fr/join/game-1?token=invite-secret#section'
      )
    ).toBe('https://poker.example/fr/join/game-1');
  });

  it('preserves the origin and pathname', () => {
    expect(
      getAnalyticsPageviewUrl('https://poker.example/en/?source=home')
    ).toBe('https://poker.example/en/');
  });

  it('rejects invalid or non-http URLs', () => {
    expect(getAnalyticsPageviewUrl('not-a-url')).toBeNull();
    expect(getAnalyticsPageviewUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('PostHog URL privacy options', () => {
  it('masks invite tokens before PostHog derives implicit URL properties', () => {
    expect(POSTHOG_URL_PRIVACY_OPTIONS).toMatchObject({
      custom_personal_data_properties: ['token'],
      disable_capture_url_hashes: true,
      mask_personal_data_properties: true,
    });
  });
});
