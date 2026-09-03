import { describe, expect, it } from 'vitest';

import { shouldPlayTimerCompletionSound } from '@/lib/timer/completion-sound';

describe('shouldPlayTimerCompletionSound', () => {
  const now = 1_800_000_000_000;

  it('plays for a fresh unseen completion marker', () => {
    expect(
      shouldPlayTimerCompletionSound(undefined, now - 1000, true, now)
    ).toBe(true);
  });

  it('does not replay a marker that was already seen', () => {
    expect(shouldPlayTimerCompletionSound(now, now, true, now)).toBe(false);
  });

  it('does not play while sound is disabled', () => {
    expect(shouldPlayTimerCompletionSound(undefined, now, false, now)).toBe(
      false
    );
  });

  it('does not play a stale marker after reconnecting', () => {
    expect(
      shouldPlayTimerCompletionSound(undefined, now - 10_001, true, now)
    ).toBe(false);
  });

  it('allows small future clock skew but rejects a distant marker', () => {
    expect(
      shouldPlayTimerCompletionSound(undefined, now + 5000, true, now)
    ).toBe(true);
    expect(
      shouldPlayTimerCompletionSound(undefined, now + 5001, true, now)
    ).toBe(false);
  });
});
