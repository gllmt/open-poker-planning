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
  onRemovePlayer: (playerId: string) => Promise<void>;
  voteError?: string | null;
  confettiSeed?: string | null;
}) {
  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <GameController
          game={game}
          players={players}
          currentPlayerId={currentPlayerId}
          confettiSeed={confettiSeed}
          onReveal={onReveal}
          onReset={onReset}
          onTimerUpdate={onTimerUpdate}
          onAutoReveal={onAutoReveal}
        />
        <Players
          game={game}
          players={players}
          currentPlayerId={currentPlayerId}
          onRemovePlayer={onRemovePlayer}
        />
      </div>
      <CardPicker
        game={game}
        players={players}
        currentPlayerId={currentPlayerId}
        onVote={onVote}
        error={voteError}
      />
    </div>
  );
}
