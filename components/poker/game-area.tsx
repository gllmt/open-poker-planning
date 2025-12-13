import { Game } from '@/types/game';
import { Player } from '@/types/player';

import { CardPicker } from './card-picker';
import { GameController } from './game-controller';
import { Players } from './players';

export function GameArea({
  game,
  players,
  currentPlayerId,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
}) {
  return (
    <>
      <div className='flex flex-col min-h-[60%] overflow-auto p-0.5 justify-center'>
        <Players game={game} players={players} currentPlayerId={currentPlayerId} />
        <GameController game={game} players={players} currentPlayerId={currentPlayerId} />
      </div>
      <div className='text-center flex justify-center'>
        <CardPicker game={game} players={players} currentPlayerId={currentPlayerId} />
      </div>
    </>
  );
}

