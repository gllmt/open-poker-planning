import { describe, expect, it } from 'vitest';
import { sanitizeInternalPath } from '@/lib/security/safe-redirect';

describe('sanitizeInternalPath', () => {
  it('allows same-origin relative paths', () => {
    expect(sanitizeInternalPath('/en/game/123')).toBe('/en/game/123');
    expect(sanitizeInternalPath('/en?token=abc#x')).toBe('/en?token=abc#x');
  });

  it('blocks protocol-relative and backslash variants', () => {
    expect(sanitizeInternalPath('//evil.com')).toBe('/');
    expect(sanitizeInternalPath('/\\evil.com')).toBe('/');
    expect(sanitizeInternalPath('/foo\\bar')).toBe('/');
  });

  it('blocks absolute URLs and non-paths', () => {
    expect(sanitizeInternalPath('https://evil.com')).toBe('/');
    expect(sanitizeInternalPath('evil.com')).toBe('/');
    expect(sanitizeInternalPath('mailto:x@y.z')).toBe('/');
  });

  it('blocks control characters and non-strings', () => {
    expect(sanitizeInternalPath('/ok\nthen')).toBe('/');
    expect(sanitizeInternalPath('/ok\tthen')).toBe('/');
    expect(sanitizeInternalPath('')).toBe('/');
    expect(sanitizeInternalPath(undefined)).toBe('/');
    expect(sanitizeInternalPath(123)).toBe('/');
  });

  it('honors a custom fallback', () => {
    expect(sanitizeInternalPath('//evil.com', '/fr')).toBe('/fr');
    expect(sanitizeInternalPath(undefined, '/fr')).toBe('/fr');
  });
});
