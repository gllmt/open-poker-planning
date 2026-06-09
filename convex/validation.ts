// Pure, runtime-agnostic validation helpers shared by Convex functions.
// Kept free of Convex-runtime imports so they can be unit-tested directly.
import { GameType } from '../types/game';

export const LIMITS = {
  name: 120,
  personName: 80,
  gameType: 40,
  emoji: 64,
  cards: 60,
  cardDisplayValue: 60,
  cardColor: 64,
  id: 80,
  invitesPerGame: 100,
  // Generous upper bound: large enough for epoch-ms timestamps, small enough
  // to reject absurd values.
  timerNumber: 1e15,
} as const;

const TIMER_FIELDS = [
  'startedAt',
  'pausedAt',
  'totalSeconds',
  'soundOn',
  'timerVisible',
  'currentSeconds',
  'timerPaused',
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
  if (typeof value !== 'string') throw new Error('INVALID_INPUT');
  const trimmed = value.trim();
  if (trimmed.length === 0 || value.length > max) {
    throw new Error('INVALID_INPUT');
  }
  return trimmed;
}

export function assertId(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_INPUT');
  if (value.length === 0 || value.length > LIMITS.id) {
    throw new Error('INVALID_INPUT');
  }
  return value;
}

export function assertTokenHash(value: unknown): string {
  if (typeof value !== 'string' || !HEX_64.test(value)) {
    throw new Error('INVALID_INPUT');
  }
  return value;
}

export function isValidGameType(value: string): boolean {
  return GAME_TYPES.has(value);
}

export function assertGameType(value: unknown): string {
  if (typeof value !== 'string' || !isValidGameType(value)) {
    throw new Error('INVALID_INPUT');
  }
  return value;
}

export function assertCards(cards: unknown): void {
  if (!Array.isArray(cards)) throw new Error('INVALID_INPUT');
  if (cards.length === 0 || cards.length > LIMITS.cards) {
    throw new Error('INVALID_INPUT');
  }
  for (const card of cards) {
    if (typeof card !== 'object' || card === null) {
      throw new Error('INVALID_INPUT');
    }
    const { value, displayValue, color } = card as Record<string, unknown>;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('INVALID_INPUT');
    }
    if (
      typeof displayValue !== 'string' ||
      displayValue.length > LIMITS.cardDisplayValue
    ) {
      throw new Error('INVALID_INPUT');
    }
    if (
      color !== undefined &&
      (typeof color !== 'string' || color.length > LIMITS.cardColor)
    ) {
      throw new Error('INVALID_INPUT');
    }
  }
}

function isValidTimerValue(value: unknown): value is number | boolean | null {
  if (value === null || typeof value === 'boolean') return true;
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= LIMITS.timerNumber
  );
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

// Strict: validates a client-supplied timer payload, rejecting unexpected
// shapes or values. Used on write.
export function assertTimerInput(
  timerProps: unknown
): Record<string, unknown> | null {
  if (timerProps === null || timerProps === undefined) return null;
  if (typeof timerProps !== 'object') throw new Error('INVALID_INPUT');

  const input = timerProps as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of TIMER_FIELDS) {
    if (!(key in input)) continue;
    if (!isValidTimerValue(input[key])) throw new Error('INVALID_INPUT');
    out[key] = input[key];
  }
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
