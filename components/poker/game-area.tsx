import type { Game, TimerProps } from '@/types/game';
import type { Player } from '@/types/player';

import { CardPicker } from './card-picker';
import { GameController } from './game-controller';
import { Players } from './players';

export function GameArea({
  game,
  players,
  currentPlayerId,
  isAdmin,
  onVote,
  onReveal,
  onReset,
  onTimerUpdate,
  onAutoReveal,
  onDeleteGame,
  onLeaveGame,
  onRemovePlayer,
  voteError,
  confettiSeed,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
  isAdmin: boolean;
  onVote: (value: number, emoji?: string) => void;
  onReveal: () => void;
  onReset: () => void;
  onTimerUpdate: (timer: TimerProps) => Promise<void>;
  onAutoReveal: (value: boolean) => Promise<void>;
  onDeleteGame: () => Promise<void>;
  onLeaveGame: () => Promise<void>;
  onRemovePlayer: (playerId: string) => Promise<void>;
  voteError?: string | null;
  confettiSeed?: string | null;
}) {
  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 w-full justify-center items-start">
        <div className="animate-scale-in stagger-1 w-full md:w-auto">
          <GameController
            game={game}
            players={players}
            currentPlayerId={currentPlayerId}
            isAdmin={isAdmin}
            confettiSeed={confettiSeed}
            onReveal={onReveal}
            onReset={onReset}
            onTimerUpdate={onTimerUpdate}
            onAutoReveal={onAutoReveal}
            onDeleteGame={onDeleteGame}
            onLeaveGame={onLeaveGame}
          />
        </div>
        <div className="animate-scale-in stagger-2 w-full md:w-auto">
          <Players
            game={game}
            players={players}
            currentPlayerId={currentPlayerId}
            onRemovePlayer={onRemovePlayer}
          />
        </div>
      </div>
      <div className="animate-fade-in-up stagger-3 text-center flex justify-center pb-4">
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
