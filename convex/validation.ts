// Pure, runtime-agnostic validation helpers shared by Convex functions.
// Only imports 'convex/values' (plain JS, no Convex runtime) so they can be
// unit-tested directly.
import { ConvexError } from 'convex/values';
import { GameType } from '../types/game';

export const LIMITS = {
  name: 120,
  personName: 80,
  emoji: 64,
  cards: 60,
  cardDisplayValue: 60,
  cardColor: 64,
  id: 80,
  invitesPerGame: 100,
  playersPerGame: 50,
  // Generous upper bound: large enough for epoch-ms timestamps, small enough
  // to reject absurd values.
  timerNumber: 1e15,
  timerTotalSeconds: 24 * 60 * 60,
} as const;

const TIMER_FIELDS = [
  'startedAt',
  'pausedAt',
  'totalSeconds',
  'soundOn',
  'timerVisible',
  'currentSeconds',
  'timerPaused',
  'elapsedSeconds',
] as const;

const HEX_64 = /^[0-9a-f]{64}$/;
const GAME_TYPES: ReadonlySet<string> = new Set(Object.values(GameType));

// Constant-time string comparison. node:crypto is unavailable in the Convex
// runtime, so this is a pure-JS equivalent. Operands are fixed-length hex
// hashes, so the length check leaks nothing meaningful.
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function assertText(value: unknown, max: number): string {
  if (typeof value !== 'string') throw new ConvexError('INVALID_INPUT');
  const trimmed = value.trim();
  if (trimmed.length === 0 || value.length > max) {
    throw new ConvexError('INVALID_INPUT');
  }
  return trimmed;
}

export function assertId(value: unknown): string {
  if (typeof value !== 'string') throw new ConvexError('INVALID_INPUT');
  if (value.length === 0 || value.length > LIMITS.id) {
    throw new ConvexError('INVALID_INPUT');
  }
  return value;
}

export function assertTokenHash(value: unknown): string {
  if (typeof value !== 'string' || !HEX_64.test(value)) {
    throw new ConvexError('INVALID_INPUT');
  }
  return value;
}

export function isValidGameType(value: string): boolean {
  return GAME_TYPES.has(value);
}

export function assertGameType(value: unknown): string {
  if (typeof value !== 'string' || !isValidGameType(value)) {
    throw new ConvexError('INVALID_INPUT');
  }
  return value;
}

export type ValidatedCard = {
  value: number;
  displayValue: string;
  color: string;
};

// Returns a normalized copy of the deck containing only the known card
// fields, so callers persist exactly what was validated and nothing else.
export function assertCards(cards: unknown): ValidatedCard[] {
  if (!Array.isArray(cards)) throw new ConvexError('INVALID_INPUT');
  if (cards.length === 0 || cards.length > LIMITS.cards) {
    throw new ConvexError('INVALID_INPUT');
  }
  const seenValues = new Set<number>();
  const normalized: ValidatedCard[] = [];
  for (const card of cards) {
    if (typeof card !== 'object' || card === null) {
      throw new ConvexError('INVALID_INPUT');
    }
    const { value, displayValue, color } = card as Record<string, unknown>;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (seenValues.has(value)) throw new ConvexError('INVALID_INPUT');
    seenValues.add(value);
    if (
      typeof displayValue !== 'string' ||
      displayValue.trim().length === 0 ||
      displayValue.length > LIMITS.cardDisplayValue
    ) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (typeof color !== 'string') {
      throw new ConvexError('INVALID_INPUT');
    }
    const normalizedColor = color.trim();
    if (
      normalizedColor.length === 0 ||
      normalizedColor.length > LIMITS.cardColor
    ) {
      throw new ConvexError('INVALID_INPUT');
    }
    normalized.push({
      value,
      displayValue: displayValue.trim(),
      color: normalizedColor,
    });
  }
  return normalized;
}

function isValidTimerValue(value: unknown): value is number | boolean | null {
  if (value === null || typeof value === 'boolean') return true;
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= LIMITS.timerNumber
  );
}

function isValidTimerInputField(key: string, value: unknown) {
  if (['soundOn', 'timerVisible', 'timerPaused'].includes(key)) {
    return typeof value === 'boolean';
  }
  if (value === null) return key === 'startedAt' || key === 'pausedAt';
  return typeof value === 'number' && value >= 0 && isValidTimerValue(value);
}

// Lenient: keep only whitelisted primitive fields, silently dropping the rest.
// Used when re-deriving timer state (reset/reveal) from possibly-legacy data.
export function pickTimerFields(timerProps: unknown): Record<string, unknown> {
  if (typeof timerProps !== 'object' || timerProps === null) return {};
  const input = timerProps as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of TIMER_FIELDS) {
    if (key in input && isValidTimerValue(input[key])) {
      out[key] = input[key];
    }
  }
  return out;
}

// Strict: validates a client-supplied timer payload, rejecting unknown keys,
// invalid values, and empty objects (callers must send null to clear the
// timer). Used on write so a malformed payload cannot wipe timer state.
export function assertTimerInput(
  timerProps: unknown
): Record<string, unknown> | null {
  if (timerProps === null || timerProps === undefined) return null;
  if (typeof timerProps !== 'object' || Array.isArray(timerProps)) {
    throw new ConvexError('INVALID_INPUT');
  }

  const input = timerProps as Record<string, unknown>;
  const allowed: ReadonlySet<string> = new Set(TIMER_FIELDS);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new ConvexError('INVALID_INPUT');
    if (!isValidTimerInputField(key, input[key])) {
      throw new ConvexError('INVALID_INPUT');
    }
    out[key] = input[key];
  }
  if (
    out.elapsedSeconds !== undefined &&
    (typeof out.elapsedSeconds !== 'number' || out.elapsedSeconds < 0)
  ) {
    throw new ConvexError('INVALID_INPUT');
  }
  if (
    out.totalSeconds !== undefined &&
    (typeof out.totalSeconds !== 'number' ||
      out.totalSeconds < 0 ||
      out.totalSeconds > LIMITS.timerTotalSeconds)
  ) {
    throw new ConvexError('INVALID_INPUT');
  }
  if (
    (typeof out.startedAt === 'number' ||
      typeof out.elapsedSeconds === 'number') &&
    typeof out.totalSeconds !== 'number'
  ) {
    throw new ConvexError('INVALID_INPUT');
  }
  if (
    typeof out.elapsedSeconds === 'number' &&
    typeof out.totalSeconds === 'number' &&
    out.elapsedSeconds > out.totalSeconds
  ) {
    throw new ConvexError('INVALID_INPUT');
  }
  if (Object.keys(out).length === 0) throw new ConvexError('INVALID_INPUT');
  return out;
}

export function isAllowedVoteValue(cards: unknown, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (!Array.isArray(cards)) return false;
  return cards.some(
    (card) =>
      typeof card === 'object' &&
      card !== null &&
      (card as { value?: unknown }).value === value
  );
}
