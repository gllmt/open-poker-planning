import { useMemo } from 'react';

import { type Game, GameType } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

export function useGameAverage(game: Game, players: Player[]) {
  return useMemo(() => {
    if (
      game.gameType === GameType.TShirt ||
      game.gameType === GameType.TShirtAndNumber
    ) {
      return null;
    }

    let values = 0;
    let count = 0;
    const cards = game.cards || [];

    players.forEach((player) => {
      const value =
        game.gameType === GameType.Custom
          ? Number(
              cards.find((card) => card.value === player.value)?.displayValue
            )
          : player.value;

      if (
        player.status === Status.Finished &&
        value !== undefined &&
        !Number.isNaN(Number(value)) &&
        Number(value) >= 0
      ) {
        values += Number(value);
        count++;
      }
    });

    if (!count) return null;
    return Math.round((values / count) * 100) / 100;
  }, [game.gameType, game.cards, players]);
}
