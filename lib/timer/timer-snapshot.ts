type TimerSnapshotInput = {
  startedAt?: number | null;
  pausedAt?: number | null;
  totalSeconds: number;
};

export type TimerSnapshot = {
  isRunning: boolean;
  elapsed: number;
  remaining: number;
  percentage: number;
};

export function getTimerSnapshot(
  { startedAt = null, pausedAt = 0, totalSeconds }: TimerSnapshotInput,
  now: number
): TimerSnapshot {
  const safeTotalSeconds = Math.max(totalSeconds, 0);
  const isRunning = startedAt !== null;
  const rawElapsed = isRunning
    ? Math.floor((now - startedAt) / 1000)
    : (pausedAt ?? 0);
  const elapsed = Math.min(Math.max(rawElapsed, 0), safeTotalSeconds);
  const remaining = Math.max(0, safeTotalSeconds - elapsed);
  const percentage =
    safeTotalSeconds > 0 ? (remaining / safeTotalSeconds) * 100 : 100;

  return { isRunning, elapsed, remaining, percentage };
}
