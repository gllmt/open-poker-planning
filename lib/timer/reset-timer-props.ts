import type { TimerProps } from '@/types/game';

export function resetTimerProps(
  timerProps: TimerProps | null | undefined
): TimerProps | null | undefined;
export function resetTimerProps(
  timerProps: unknown
): Record<string, unknown> | null | undefined;
export function resetTimerProps(timerProps: unknown) {
  if (timerProps === undefined) return undefined;
  if (timerProps === null) return null;
  if (typeof timerProps !== 'object') return null;
  return {
    ...(timerProps as Record<string, unknown>),
    startedAt: null,
    pausedAt: 0,
  };
}
