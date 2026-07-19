export type SessionExitReason = 'left' | 'missing-session' | 'removed';

type JoinViewerState =
  | { type: 'ready' }
  | { type: 'revoked'; reason: SessionExitReason }
  | { type: 'not_found' }
  | null;

function parseSessionExitReason(
  value: string | string[] | undefined
): SessionExitReason | undefined {
  const reason = Array.isArray(value) ? value[0] : value;
  if (
    reason === 'left' ||
    reason === 'missing-session' ||
    reason === 'removed'
  ) {
    return reason;
  }
  return undefined;
}

export function resolveJoinSession({
  reasonParam,
  viewerState,
}: {
  reasonParam: string | string[] | undefined;
  viewerState: JoinViewerState;
}) {
  if (viewerState?.type === 'ready') {
    return {
      redirectToGame: true,
      reason: undefined,
      shouldClearSession: false,
    } as const;
  }

  if (viewerState?.type === 'revoked') {
    return {
      redirectToGame: false,
      reason: viewerState.reason,
      shouldClearSession: true,
    } as const;
  }

  return {
    redirectToGame: false,
    reason: parseSessionExitReason(reasonParam),
    shouldClearSession: false,
  } as const;
}
