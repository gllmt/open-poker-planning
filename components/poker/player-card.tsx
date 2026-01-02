'use client';

import {
  Check,
  CircleQuestionMark,
  CircleUserRound,
  Coffee,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { removePlayer } from '@/lib/api/games';
import { isModerator } from '@/lib/is-moderator';
import { cn } from '@/lib/utils';
import type { Game } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { getCards, normalizeLegacyCards } from './card-configs';

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

  const hasVoted = player.status === Status.Finished;
  const isRevealed = game.gameStatus === Status.Finished;
  const cardDisplayValue =
    hasVoted && isRevealed ? getCardDisplayValue(game, player.value) : '';
  const shouldShowCoffee = hasVoted && isRevealed && player.value === -1;
  const shouldShowQuestion = hasVoted && isRevealed && player.value === -2;

  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-card-foreground max-w-content">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar size="sm" className="shrink-0">
          <AvatarImage src={undefined} alt={player.name} />
          <AvatarFallback className="bg-background/70 text-muted-foreground">
            <CircleUserRound className="size-4" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold" title={player.name}>
            {player.name}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {!isRevealed && (
          <span className="flex size-5 items-center justify-center">
            {hasVoted ? (
              <Check className="size-4 text-emerald-500" aria-hidden="true" />
            ) : null}
          </span>
        )}
        {isRevealed && (
          <span
            className={cn(
              'min-w-10 rounded-full px-2 py-1 text-center text-xs font-semibold',
              hasVoted
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {hasVoted ? (
              shouldShowCoffee ? (
                <Coffee className="inline-block size-4" aria-hidden="true" />
              ) : shouldShowQuestion ? (
                <CircleQuestionMark
                  className="inline-block size-4"
                  aria-hidden="true"
                />
              ) : (
                cardDisplayValue || '-'
              )
            ) : (
              '-'
            )}
          </span>
        )}
        {canRemove && (
          <Button
            type="button"
            title="Remove"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            remove player
          </Button>
        )}
      </div>
    </div>
  );
}

function getCardDisplayValue(
  game: Game,
  cardValue: number | undefined
): string {
  const cards = normalizeLegacyCards(
    game.gameType,
    game.cards?.length ? game.cards : getCards(game.gameType)
  );
  return (
    cards.find((card) => card.value === cardValue)?.displayValue ||
    cardValue?.toString() ||
    ''
  );
}
