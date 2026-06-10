const KNOWN_CODES = new Set([
  'NOT_FOUND',
  'UNAUTHORIZED',
  'INVALID_INVITE',
  'GAME_FINISHED',
  'INVALID_INPUT',
  'TOO_MANY_INVITES',
]);

type ConvexErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'INVALID_INVITE'
  | 'GAME_FINISHED'
  | 'INVALID_INPUT'
  | 'TOO_MANY_INVITES';

// Convex redacts plain Error messages in production and wraps them with
// request metadata in dev, so the only reliable channel for an application
// error code is the `data` payload of a ConvexError. Checked structurally
// (Error with a string `data`) rather than via instanceof so it keeps working
// across duplicated copies of the convex package. The exact-message fallback
// covers plain Errors in local/unit-test contexts.
export function getConvexErrorCode(error: unknown): ConvexErrorCode | null {
  if (!(error instanceof Error)) return null;

  const data = (error as Error & { data?: unknown }).data;
  if (typeof data === 'string' && KNOWN_CODES.has(data)) {
    return data as ConvexErrorCode;
  }

  if (KNOWN_CODES.has(error.message)) {
    return error.message as ConvexErrorCode;
  }
  return null;
}
