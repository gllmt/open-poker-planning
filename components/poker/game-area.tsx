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
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
  onVote: (value: number, emoji?: string) => void;
  voteError?: string | null;
}) {
  return (
    <>
    <div className="flex flex-col gap-4">
    <GameController
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
      <div className="flex flex-col min-h-[60%] overflow-auto p-0.5 justify-center">
        <Players
          game={game}
          players={players}
          currentPlayerId={currentPlayerId}
        />
      </div>
    </>
  );
}
