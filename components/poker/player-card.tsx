'use client';

import { removePlayer } from '@/lib/api/games';
import { isModerator } from '@/lib/is-moderator';
import type { Game, GameType } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { getCards } from './card-configs';

export function PlayerCard({
  game,
  player,
  currentPlayerId,
}: {
  game: Game;
  player: Player;
  currentPlayerId: string;
}) {
  const canRemove =
    isModerator(
      game.createdById,
      currentPlayerId,
      game.isAllowMembersToManageSession
    ) && player.id !== currentPlayerId;

  const onRemove = async () => {
    await removePlayer(game.id, player.id, currentPlayerId);
  };

  return (
    <div
      className="rounded shadow-lg w-25 bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-600 border mb-2 m-3"
      style={{
        backgroundColor: getCardColor(game, player.value),
      }}
    >
      <div className="text-center -mt-5 mx-auto w-[95%] bg-white dark:bg-gray-900 border-2 border-gray-400 dark:border-gray-700 rounded-2xl flex items-center justify-around px-3 py-1">
        <div
          className="text-center font-semibold text-sm truncate"
          title={player.name}
        >
          {player.name}
        </div>
        {canRemove && (
          <button
            type="button"
            title="Remove"
            className="cursor-pointer p-0.5 mt-0.5 rounded hover:bg-red-100 transition"
            onClick={onRemove}
          >
            🗑️
          </button>
        )}
      </div>
      <div className="flex items-center justify-center text-gray-800 py-6 mb-3">
        <span
          className={`${getCardValue(player, game)?.length < 2 ? 'text-4xl' : 'text-3xl'}`}
        >
          {getCardValue(player, game)}
        </span>
      </div>
    </div>
  );
}

function getCardColor(game: Game, value: number | undefined): string {
  if (game.gameStatus === Status.Finished) {
    const card = (
      game.cards?.length ? game.cards : getCards(game.gameType)
    ).find((c) => c.value === value);
    return card ? card.color : '';
  }
  return '';
}

function getCardValue(player: Player, game: Game) {
  if (game.gameStatus !== Status.Finished) {
    return player.status === Status.Finished ? '👍' : '🤔';
  }

  if (player.status === Status.Finished) {
    if (player.value === -1) return player.emoji || '☕';
    return getCardDisplayValue(game, player.value);
  }
  return '🤔';
}

function getCardDisplayValue(
  game: Game,
  cardValue: number | undefined
): string {
  const cards = game.cards?.length
    ? game.cards
    : getCards(game.gameType as GameType);
  return (
    cards.find((card) => card.value === cardValue)?.displayValue ||
    cardValue?.toString() ||
    ''
  );
}
