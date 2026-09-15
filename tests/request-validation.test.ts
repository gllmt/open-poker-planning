import { describe, expect, it } from 'vitest';
import { isValidUuid } from '@/lib/security/request-validation';

describe('isValidUuid', () => {
  it('accepts generated UUID-shaped game ids', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it.each([
    '',
    'not-a-uuid',
    '550e8400e29b41d4a716446655440000',
    '550e8400-e29b-41d4-a716-446655440000-extra',
    '../550e8400-e29b-41d4-a716-446655440000',
  ])('rejects malformed game id %j', (value) => {
    expect(isValidUuid(value)).toBe(false);
  });
});
