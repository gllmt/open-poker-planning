import { describe, expect, it } from 'vitest';

import {
  assertCards,
  assertGameType,
  assertId,
  assertText,
  assertTimerInput,
  assertTokenHash,
  isAllowedVoteValue,
  isValidGameType,
  LIMITS,
  pickTimerFields,
  timingSafeStringEqual,
} from '@/convex/validation';

const HASH = 'a'.repeat(64);

describe('timingSafeStringEqual', () => {
  it('matches equal strings and rejects others', () => {
    expect(timingSafeStringEqual(HASH, HASH)).toBe(true);
    expect(timingSafeStringEqual(HASH, `b${HASH.slice(1)}`)).toBe(false);
    expect(timingSafeStringEqual('abc', 'ab')).toBe(false);
    expect(timingSafeStringEqual('', '')).toBe(true);
  });
});

describe('assertText', () => {
  it('returns the trimmed value when valid', () => {
    expect(assertText('  hello  ', 50)).toBe('hello');
  });

  it('rejects empty, whitespace, oversized, or non-string', () => {
    expect(() => assertText('', 50)).toThrow('INVALID_INPUT');
    expect(() => assertText('   ', 50)).toThrow('INVALID_INPUT');
    expect(() => assertText('a'.repeat(51), 50)).toThrow('INVALID_INPUT');
    expect(() => assertText(123 as unknown as string, 50)).toThrow(
      'INVALID_INPUT'
    );
  });
});

describe('assertId', () => {
  it('accepts bounded non-empty strings', () => {
    expect(assertId('abc-123')).toBe('abc-123');
  });

  it('rejects empty, oversized, or non-string', () => {
    expect(() => assertId('')).toThrow('INVALID_INPUT');
    expect(() => assertId('a'.repeat(LIMITS.id + 1))).toThrow('INVALID_INPUT');
    expect(() => assertId(null as unknown as string)).toThrow('INVALID_INPUT');
  });
});

describe('assertTokenHash', () => {
  it('accepts a 64-char lowercase hex string', () => {
    expect(assertTokenHash(HASH)).toBe(HASH);
  });

  it('rejects wrong length, non-hex, uppercase, or non-string', () => {
    expect(() => assertTokenHash('abc')).toThrow('INVALID_INPUT');
    expect(() => assertTokenHash('z'.repeat(64))).toThrow('INVALID_INPUT');
    expect(() => assertTokenHash('A'.repeat(64))).toThrow('INVALID_INPUT');
    expect(() => assertTokenHash(123 as unknown as string)).toThrow(
      'INVALID_INPUT'
    );
  });
});

describe('game type', () => {
  it('recognizes known types only', () => {
    expect(isValidGameType('Fibonacci')).toBe(true);
    expect(isValidGameType('Custom')).toBe(true);
    expect(isValidGameType('Nope')).toBe(false);
    expect(assertGameType('TShirt')).toBe('TShirt');
    expect(() => assertGameType('Nope')).toThrow('INVALID_INPUT');
  });
});

describe('assertCards', () => {
  const card = { value: 1, displayValue: '1', color: '#fff' };

  it('returns a normalized deck containing only known fields', () => {
    expect(
      assertCards([
        { ...card, evil: { huge: 'payload' } },
        { value: -1, displayValue: ' ? ', color: ' #000 ' },
      ])
    ).toEqual([
      { value: 1, displayValue: '1', color: '#fff' },
      { value: -1, displayValue: '?', color: '#000' },
    ]);
  });

  it('rejects empty, oversized, or malformed decks', () => {
    expect(() => assertCards([])).toThrow('INVALID_INPUT');
    expect(() => assertCards('nope')).toThrow('INVALID_INPUT');
    expect(() =>
      assertCards(
        Array.from({ length: LIMITS.cards + 1 }, (_, i) => ({
          ...card,
          value: i,
        }))
      )
    ).toThrow('INVALID_INPUT');
    expect(() => assertCards([{ displayValue: '1' }])).toThrow('INVALID_INPUT');
    expect(() =>
      assertCards([{ value: Number.NaN, displayValue: '1' }])
    ).toThrow('INVALID_INPUT');
    expect(() => assertCards([{ value: 1, displayValue: 5 }])).toThrow(
      'INVALID_INPUT'
    );
    expect(() => assertCards([{ value: 1, displayValue: '1' }])).toThrow(
      'INVALID_INPUT'
    );
    expect(() =>
      assertCards([{ value: 1, displayValue: '1', color: '   ' }])
    ).toThrow('INVALID_INPUT');
  });

  it('rejects duplicate values and blank labels', () => {
    expect(() => assertCards([card, { ...card, displayValue: '2' }])).toThrow(
      'INVALID_INPUT'
    );
    expect(() => assertCards([{ value: 1, displayValue: '   ' }])).toThrow(
      'INVALID_INPUT'
    );
  });
});

describe('timer helpers', () => {
  it.each([
    { startedAt: false, totalSeconds: 300 },
    { pausedAt: true },
    { pausedAt: -1 },
    { soundOn: 1 },
    { timerVisible: null },
    { timerPaused: 0 },
    { currentSeconds: false },
    { elapsedSeconds: null },
  ])('rejects field-incompatible timer values: %j', (value) => {
    expect(() => assertTimerInput(value)).toThrow('INVALID_INPUT');
  });

  it('pickTimerFields keeps only whitelisted primitives', () => {
    expect(
      pickTimerFields({
        startedAt: 1000,
        soundOn: true,
        evil: { huge: 'x' },
        currentSeconds: 'no',
      })
    ).toEqual({ startedAt: 1000, soundOn: true });
    expect(pickTimerFields('nope')).toEqual({});
    expect(pickTimerFields(null)).toEqual({});
  });

  it('assertTimerInput validates strictly', () => {
    expect(assertTimerInput(null)).toBeNull();
    expect(assertTimerInput(undefined)).toBeNull();
    expect(assertTimerInput({ totalSeconds: 60, timerPaused: false })).toEqual({
      totalSeconds: 60,
      timerPaused: false,
    });
    expect(() => assertTimerInput('nope')).toThrow('INVALID_INPUT');
    expect(() =>
      assertTimerInput({ totalSeconds: Number.POSITIVE_INFINITY })
    ).toThrow('INVALID_INPUT');
    expect(() => assertTimerInput({ soundOn: 'yes' })).toThrow('INVALID_INPUT');
  });

  it('assertTimerInput rejects unknown keys and empty payloads', () => {
    expect(() => assertTimerInput({ extra: 1 })).toThrow('INVALID_INPUT');
    expect(() => assertTimerInput({ startedAt: 1000, extra: 1 })).toThrow(
      'INVALID_INPUT'
    );
    expect(() => assertTimerInput({})).toThrow('INVALID_INPUT');
    expect(() => assertTimerInput([1000])).toThrow('INVALID_INPUT');
  });

  it('assertTimerInput accepts elapsedSeconds start commands', () => {
    expect(
      assertTimerInput({
        elapsedSeconds: 5,
        startedAt: 123,
        pausedAt: null,
        totalSeconds: 300,
      })
    ).toEqual({
      elapsedSeconds: 5,
      startedAt: 123,
      pausedAt: null,
      totalSeconds: 300,
    });
  });

  it('assertTimerInput rejects negative elapsedSeconds', () => {
    expect(() => assertTimerInput({ elapsedSeconds: -1 })).toThrow(
      'INVALID_INPUT'
    );
  });

  it('assertTimerInput rejects non-numeric elapsedSeconds', () => {
    expect(() => assertTimerInput({ elapsedSeconds: 'x' })).toThrow(
      'INVALID_INPUT'
    );
  });

  it('assertTimerInput bounds timer duration and start progress', () => {
    expect(() =>
      assertTimerInput({ totalSeconds: LIMITS.timerTotalSeconds + 1 })
    ).toThrow('INVALID_INPUT');
    expect(() => assertTimerInput({ totalSeconds: -1 })).toThrow(
      'INVALID_INPUT'
    );
    expect(() => assertTimerInput({ startedAt: 1000 })).toThrow(
      'INVALID_INPUT'
    );
    expect(() =>
      assertTimerInput({ elapsedSeconds: 61, totalSeconds: 60 })
    ).toThrow('INVALID_INPUT');
  });
});

describe('isAllowedVoteValue', () => {
  const cards = [
    { value: 0, displayValue: '0' },
    { value: 5, displayValue: '5' },
    { value: -1, displayValue: 'Coffee' },
  ];

  it('accepts values present in the deck only', () => {
    expect(isAllowedVoteValue(cards, 5)).toBe(true);
    expect(isAllowedVoteValue(cards, -1)).toBe(true);
    expect(isAllowedVoteValue(cards, 99)).toBe(false);
    expect(isAllowedVoteValue(cards, Number.NaN)).toBe(false);
    expect(isAllowedVoteValue('nope', 5)).toBe(false);
  });
});
