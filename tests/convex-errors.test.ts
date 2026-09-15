import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { getConvexErrorCode } from '@/lib/convex/errors';

describe('getConvexErrorCode', () => {
  it('reads known codes from ConvexError data', () => {
    expect(getConvexErrorCode(new ConvexError('NOT_FOUND'))).toBe('NOT_FOUND');
    expect(getConvexErrorCode(new ConvexError('UNAUTHORIZED'))).toBe(
      'UNAUTHORIZED'
    );
    expect(getConvexErrorCode(new ConvexError('INVALID_INVITE'))).toBe(
      'INVALID_INVITE'
    );
    expect(getConvexErrorCode(new ConvexError('GAME_FINISHED'))).toBe(
      'GAME_FINISHED'
    );
    expect(getConvexErrorCode(new ConvexError('INVALID_INPUT'))).toBe(
      'INVALID_INPUT'
    );
    expect(getConvexErrorCode(new ConvexError('TOO_MANY_INVITES'))).toBe(
      'TOO_MANY_INVITES'
    );
  });

  it('reads the data payload even when the message is wrapped, as Convex clients do', () => {
    // Convex clients rewrite error messages with request metadata (and redact
    // them entirely in prod); only the data payload survives verbatim.
    const wrapped = new ConvexError('UNAUTHORIZED');
    wrapped.message =
      '[CONVEX M(games:reveal)] [Request ID: abc123] Server Error';
    expect(getConvexErrorCode(wrapped)).toBe('UNAUTHORIZED');
  });

  it('falls back to exact plain-Error messages', () => {
    expect(getConvexErrorCode(new Error('NOT_FOUND'))).toBe('NOT_FOUND');
    expect(getConvexErrorCode(new Error('INVALID_INPUT'))).toBe(
      'INVALID_INPUT'
    );
  });

  it('returns null for unknown codes, wrapped plain errors, or non-Error values', () => {
    expect(getConvexErrorCode(new Error('OTHER'))).toBeNull();
    expect(
      getConvexErrorCode(new Error('[Request ID: abc123] Server Error'))
    ).toBeNull();
    expect(
      getConvexErrorCode(new ConvexError({ unexpected: true }))
    ).toBeNull();
    expect(getConvexErrorCode('NOT_FOUND')).toBeNull();
    expect(getConvexErrorCode(null)).toBeNull();
  });
});
