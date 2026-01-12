import type { Game, TimerProps } from '@/types/game';
import type { Player } from '@/types/player';

import { CardPicker } from './card-picker';
import { GameController } from './game-controller';
import { Players } from './players';

export function GameArea({
  game,
  players,
  currentPlayerId,
  onVote,
  onReveal,
  onReset,
  onTimerUpdate,
  voteError,
  confettiSeed,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
  onVote: (value: number, emoji?: string) => void;
  onReveal: () => void;
  onReset: () => void;
  onTimerUpdate: (timer: TimerProps) => void;
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
          onReveal={onReveal}
          onReset={onReset}
          onTimerUpdate={onTimerUpdate}
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
