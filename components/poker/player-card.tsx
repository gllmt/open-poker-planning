'use client';

import { Button } from '@/components/ui/button';
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
      className="border-border bg-muted text-foreground w-25 rounded-2xl border shadow-sm mb-2 m-3"
      style={{
        backgroundColor: getCardColor(game, player.value),
      }}
    >
      <div className="bg-background border-border text-center -mt-5 mx-auto w-[95%] rounded-2xl border-2 flex items-center justify-around px-3 py-1">
        <div
          className="text-center font-semibold text-sm truncate"
          title={player.name}
        >
          {player.name}
        </div>
        {canRemove && (
          <Button
            type="button"
            title="Remove"
            variant="ghost"
            size="icon-xs"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            🗑️
          </Button>
        )}
      </div>
      <div className="flex items-center justify-center text-foreground py-6 mb-3">
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
