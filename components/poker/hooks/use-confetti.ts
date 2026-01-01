import { useMemo } from 'react';

import type { Game } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

export function useConfetti(game: Game, players: Player[]) {
  return useMemo(() => {
    if (game.gameStatus !== Status.Finished) return false;

    const revealedVotes = players
      .filter(
        (player) =>
          player.status === Status.Finished && player.value !== undefined
      )
      .map((player) => player.value as number);

    if (revealedVotes.length < 2) return false;
    return revealedVotes.every((value) => value === revealedVotes[0]);
  }, [game.gameStatus, players]);
}
