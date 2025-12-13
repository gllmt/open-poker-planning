import { Game } from '@/types/game';
import { Player } from '@/types/player';

import { PlayerCard } from './player-card';

export function Players({ game, players, currentPlayerId }: { game: Game; players: Player[]; currentPlayerId: string }) {
  return (
    <div>
      <div className='flex flex-wrap justify-center gap-2 pt-8 w-full'>
        {players.map((player) => (
          <PlayerCard key={player.id} game={game} player={player} currentPlayerId={currentPlayerId} />
        ))}
      </div>
    </div>
  );
}

