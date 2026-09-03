const MAX_COMPLETION_AGE_MS = 10_000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5_000;

export function shouldPlayTimerCompletionSound(
  previousCompletedAt: number | undefined,
  nextCompletedAt: number | undefined,
  soundOn: boolean,
  now: number
) {
  if (
    !soundOn ||
    nextCompletedAt === undefined ||
    !Number.isFinite(nextCompletedAt) ||
    nextCompletedAt === previousCompletedAt
  ) {
    return false;
  }

  const age = now - nextCompletedAt;
  return age >= -MAX_FUTURE_CLOCK_SKEW_MS && age <= MAX_COMPLETION_AGE_MS;
}
