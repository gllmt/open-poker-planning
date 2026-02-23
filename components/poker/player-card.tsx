'use client';

import { Check, CircleUserRound, Crown, UserMinus } from 'lucide-react';
import { memo } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

export const PlayerCard = memo(function PlayerCard({
  gameStatus,
  isSessionOwner,
  isCurrentPlayerModerator,
  player,
  currentPlayerId,
  onRemovePlayer,
}: {
  gameStatus: Status;
  isSessionOwner: boolean;
  isCurrentPlayerModerator: boolean;
  player: Player;
  currentPlayerId: string;
  onRemovePlayer: (playerId: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const canRemove = isCurrentPlayerModerator && player.id !== currentPlayerId;

  const onRemove = async () => {
    await onRemovePlayer(player.id);
  };

  const hasVoted = player.status === Status.Finished;
  const isDimmed = gameStatus !== Status.Finished && !hasVoted;
  const cardOpacityClass = isDimmed ? 'opacity-60' : 'opacity-100';
  const voteIconClass = hasVoted ? 'opacity-100' : 'opacity-0';

  return (
    <div
      className={`max-w-content flex w-full items-center justify-between gap-3 rounded-4xl border px-3 py-2.5 text-card-foreground transition-all duration-200 ease-out ${
        isDimmed
          ? 'border-transparent bg-muted/40'
          : 'border-border/70 bg-background/75 shadow-xs'
      } ${cardOpacityClass}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative">
          <Avatar size="sm" className="shrink-0">
            <AvatarImage src={undefined} alt={player.name} />
            <AvatarFallback className="bg-primary/15 text-primary">
              <CircleUserRound className="size-4" aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
          {isSessionOwner && (
            <span
              className="bg-amber-400 text-white absolute -right-1 -top-1 inline-flex size-4 items-center justify-center rounded-full"
              title={t('playerCard.ownerTitle')}
            >
              <Crown className="size-2.5" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold" title={player.name}>
            {player.name}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {gameStatus !== Status.Finished && (
          <span className="flex size-5 items-center justify-center">
            <Check
              className={`size-4 text-emerald-500 transition-opacity duration-200 ${voteIconClass}`}
              aria-hidden="true"
            />
          </span>
        )}
        {canRemove && (
          <Button
            type="button"
            title={t('playerCard.removeTitle')}
            variant="outline"
            size="icon-xs"
            className="rounded-full text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <UserMinus className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{t('playerCard.removeButton')}</span>
          </Button>
        )}
      </div>
    </div>
  );
});
