import { describe, expect, it } from 'vitest';
import { assertProductionConvexConfig } from '../scripts/check-convex-deployment.mjs';

const production = {
  VERCEL_ENV: 'production',
  CONVEX_DEPLOY_KEY: 'prod:production-example-123|synthetic-key',
  NEXT_PUBLIC_CONVEX_URL: 'https://production-example-123.convex.cloud',
  CONVEX_SERVICE_SECRET: 'synthetic-secret-'.repeat(3),
};

describe('production Convex deployment configuration', () => {
  it('accepts a production key matching the configured backend', () => {
    expect(() => assertProductionConvexConfig(production)).not.toThrow();
  });

  it.each([
    undefined,
    '',
    'dev:development-example-123|synthetic-key',
    'preview:example-team:example-project|synthetic-key',
    'prod:production-example-123|',
  ])('rejects an invalid production key before deployment: %s', (key) => {
    expect(() =>
      assertProductionConvexConfig({ ...production, CONVEX_DEPLOY_KEY: key })
    ).toThrow('Production requires a Convex production deploy key');
  });

  it.each([undefined, 'https://different-example-456.convex.cloud'])(
    'rejects a missing or mismatched frontend URL: %s',
    (url) => {
      expect(() =>
        assertProductionConvexConfig({
          ...production,
          NEXT_PUBLIC_CONVEX_URL: url,
        })
      ).toThrow('must target the same production deployment');
    }
  );

  it.each([undefined, 'too-short'])(
    'rejects an unavailable service secret without exposing it: %s',
    (secret) => {
      expect(() =>
        assertProductionConvexConfig({
          ...production,
          CONVEX_SERVICE_SECRET: secret,
        })
      ).toThrow('Production requires CONVEX_SERVICE_SECRET');
    }
  );

  it('does not impose the fixed production URL on isolated previews', () => {
    expect(() =>
      assertProductionConvexConfig({ VERCEL_ENV: 'preview' })
    ).not.toThrow();
  });
});
