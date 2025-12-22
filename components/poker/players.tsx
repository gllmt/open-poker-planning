import { UserRound } from 'lucide-react';
import type { Game } from '@/types/game';
import type { Player } from '@/types/player';

import { PlayerCard } from './player-card';

export function Players({
  game,
  players,
  currentPlayerId,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
}) {
  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-primary/20 p-3">
      <div className="flex w-full items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Players</h2>
        <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          <UserRound className="size-4" />
          <span>{players.length}</span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            game={game}
            player={player}
            currentPlayerId={currentPlayerId}
          />
        ))}
      </div>
    </div>
  );
}
