import { describe, expect, it } from 'vitest';

import { getConvexErrorCode } from '@/lib/convex/errors';

describe('getConvexErrorCode', () => {
  it('returns known Convex error codes from Error messages', () => {
    expect(getConvexErrorCode(new Error('NOT_FOUND'))).toBe('NOT_FOUND');
    expect(getConvexErrorCode(new Error('UNAUTHORIZED'))).toBe('UNAUTHORIZED');
    expect(getConvexErrorCode(new Error('INVALID_INVITE'))).toBe(
      'INVALID_INVITE'
    );
    expect(getConvexErrorCode(new Error('GAME_FINISHED'))).toBe(
      'GAME_FINISHED'
    );
    expect(getConvexErrorCode(new Error('INVALID_INPUT'))).toBe(
      'INVALID_INPUT'
    );
    expect(getConvexErrorCode(new Error('TOO_MANY_INVITES'))).toBe(
      'TOO_MANY_INVITES'
    );
  });

  it('returns null for unknown or non-Error values', () => {
    expect(getConvexErrorCode(new Error('OTHER'))).toBeNull();
    expect(getConvexErrorCode('NOT_FOUND')).toBeNull();
    expect(getConvexErrorCode(null)).toBeNull();
  });
});
