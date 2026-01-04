import type { Game } from '@/types/game';
import type { Player } from '@/types/player';

import { CardPicker } from './card-picker';
import { GameController } from './game-controller';
import { Players } from './players';

export function GameArea({
  game,
  players,
  currentPlayerId,
  onVote,
  voteError,
  confettiSeed,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
  onVote: (value: number, emoji?: string) => void;
  voteError?: string | null;
  confettiSeed?: string | null;
}) {
  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 w-full justify-center items-center">
        <GameController
          game={game}
          players={players}
          currentPlayerId={currentPlayerId}
          confettiSeed={confettiSeed}
        />
        <Players
          game={game}
          players={players}
          currentPlayerId={currentPlayerId}
        />
      </div>
      <div className="text-center flex justify-center pb-4">
        <CardPicker
          game={game}
          players={players}
          currentPlayerId={currentPlayerId}
          onVote={onVote}
          error={voteError}
        />
      </div>
    </>
  );
}
