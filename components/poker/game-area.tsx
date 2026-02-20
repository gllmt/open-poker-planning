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
  onAutoReveal,
  onDeleteGame,
  onRemovePlayer,
  voteError,
  confettiSeed,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
  onVote: (value: number, emoji?: string) => void;
  onReveal: () => void;
  onReset: () => void;
  onTimerUpdate: (timer: TimerProps) => Promise<void>;
  onAutoReveal: (value: boolean) => Promise<void>;
  onDeleteGame: () => Promise<void>;
  onRemovePlayer: (playerId: string) => Promise<void>;
  voteError?: string | null;
  confettiSeed?: string | null;
}) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row gap-6 w-full justify-center items-center">
        <GameController
          game={game}
          players={players}
          currentPlayerId={currentPlayerId}
          confettiSeed={confettiSeed}
          onReveal={onReveal}
          onReset={onReset}
          onTimerUpdate={onTimerUpdate}
          onAutoReveal={onAutoReveal}
          onDeleteGame={onDeleteGame}
        />
        <Players
          game={game}
          players={players}
          currentPlayerId={currentPlayerId}
          onRemovePlayer={onRemovePlayer}
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
    </div>
  );
}
