import { describe, expect, it } from 'vitest';

import { getTimerSnapshot } from '@/lib/timer/timer-snapshot';

describe('getTimerSnapshot', () => {
  it('calculates a running timer from its start timestamp', () => {
    expect(
      getTimerSnapshot(
        { startedAt: 10_000, pausedAt: null, totalSeconds: 60 },
        25_000
      )
    ).toEqual({
      isRunning: true,
      elapsed: 15,
      remaining: 45,
      percentage: 75,
    });
  });

  it('uses paused elapsed time when the timer is stopped', () => {
    expect(
      getTimerSnapshot(
        { startedAt: null, pausedAt: 20, totalSeconds: 80 },
        999_999
      )
    ).toEqual({
      isRunning: false,
      elapsed: 20,
      remaining: 60,
      percentage: 75,
    });
  });

  it('clamps elapsed time after the deadline', () => {
    expect(
      getTimerSnapshot(
        { startedAt: 10_000, pausedAt: null, totalSeconds: 60 },
        80_000
      )
    ).toEqual({
      isRunning: true,
      elapsed: 60,
      remaining: 0,
      percentage: 0,
    });
  });

  it('keeps the existing full percentage for a zero duration', () => {
    expect(
      getTimerSnapshot(
        { startedAt: null, pausedAt: 0, totalSeconds: 0 },
        10_000
      )
    ).toEqual({
      isRunning: false,
      elapsed: 0,
      remaining: 0,
      percentage: 100,
    });
  });

  it('clamps a future start timestamp to zero elapsed time', () => {
    expect(
      getTimerSnapshot(
        { startedAt: 20_000, pausedAt: null, totalSeconds: 60 },
        10_000
      )
    ).toEqual({
      isRunning: true,
      elapsed: 0,
      remaining: 60,
      percentage: 100,
    });
  });
});
