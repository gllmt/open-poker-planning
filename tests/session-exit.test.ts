import { describe, expect, it } from 'vitest';

import { resolveJoinSession } from '@/lib/security/session-exit';

describe('resolveJoinSession', () => {
  it('keeps an active session even when the URL claims it was removed', () => {
    expect(
      resolveJoinSession({
        reasonParam: 'removed',
        viewerState: { type: 'ready' },
      })
    ).toEqual({
      redirectToGame: true,
      reason: undefined,
      shouldClearSession: false,
    });
  });

  it('uses the server-verified revocation reason', () => {
    expect(
      resolveJoinSession({
        reasonParam: 'removed',
        viewerState: { type: 'revoked', reason: 'missing-session' },
      })
    ).toEqual({
      redirectToGame: false,
      reason: 'missing-session',
      shouldClearSession: true,
    });
  });

  it('allows a valid reason to be displayed without clearing an unverified session', () => {
    expect(
      resolveJoinSession({ reasonParam: ['left'], viewerState: null })
    ).toEqual({
      redirectToGame: false,
      reason: 'left',
      shouldClearSession: false,
    });
  });

  it('ignores unknown reasons', () => {
    expect(
      resolveJoinSession({
        reasonParam: 'attacker-controlled',
        viewerState: null,
      })
    ).toEqual({
      redirectToGame: false,
      reason: undefined,
      shouldClearSession: false,
    });
  });
});
