import { describe, expect, it } from 'vitest';
import { getCards } from '@/components/poker/card-configs';
import { getResultSummary } from '@/components/poker/results/result-summary';
import { type Game, GameType } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

function createGame(
  gameType = GameType.Fibonacci,
  cards = getCards(gameType)
): Game {
  return {
    id: 'game-1',
    name: 'Test game',
    gameStatus: Status.Finished,
    gameType,
    cards,
    createdBy: 'Alice',
    createdById: 'player-1',
  };
}

function createPlayers(values: number[]): Player[] {
  return values.map((value, index) => ({
    id: `player-${index + 1}`,
    name: `Player ${index + 1}`,
    status: Status.Finished,
    value,
  }));
}

describe('getResultSummary', () => {
  it('computes the average and the uniquely most played card', () => {
    const summary = getResultSummary(createGame(), createPlayers([5, 5, 5, 1]));

    expect(summary).toMatchObject({
      average: 4,
      mostPlayedCount: 3,
      isMostPlayedTie: false,
    });
    expect(summary.mostPlayedCard?.displayValue).toBe('5');
  });

  it('ignores non-numeric cards in the average but counts them as votes', () => {
    const summary = getResultSummary(
      createGame(),
      createPlayers([8, -1, -1, -2])
    );

    expect(summary.average).toBe(8);
    expect(summary.mostPlayedCard?.value).toBe(-1);
    expect(summary.mostPlayedCount).toBe(2);
  });

  it('reports a tie instead of selecting an arbitrary card', () => {
    const summary = getResultSummary(createGame(), createPlayers([3, 5]));

    expect(summary.average).toBe(4);
    expect(summary.mostPlayedCard).toBeNull();
    expect(summary.isMostPlayedTie).toBe(true);
  });

  it('uses numeric custom labels instead of their internal indexes', () => {
    const customCards = [
      { value: 0, displayValue: '2', color: '#fff' },
      { value: 1, displayValue: '8', color: '#000' },
    ];
    const summary = getResultSummary(
      createGame(GameType.Custom, customCards),
      createPlayers([0, 1])
    );

    expect(summary.average).toBe(5);
  });

  it('keeps non-numeric decks out of the average calculation', () => {
    const summary = getResultSummary(
      createGame(GameType.TShirt),
      createPlayers([40, 40, 50])
    );

    expect(summary.average).toBeNull();
    expect(summary.mostPlayedCard?.displayValue).toBe('M');
  });

  it('ignores players without a revealed vote', () => {
    const players: Player[] = [
      ...createPlayers([5, 5]),
      {
        id: 'player-pending',
        name: 'Pending player',
        status: Status.Started,
        value: 89,
      },
    ];

    const summary = getResultSummary(createGame(), players);

    expect(summary.average).toBe(5);
    expect(summary.mostPlayedCount).toBe(2);
  });
});
