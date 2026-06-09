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

export function getConvexErrorCode(error: unknown): ConvexErrorCode | null {
  const message = error instanceof Error ? error.message : null;
  if (message && KNOWN_CODES.has(message)) return message as ConvexErrorCode;
  return null;
}
