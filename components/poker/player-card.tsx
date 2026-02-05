'use client';

import { Check, CircleUserRound } from 'lucide-react';
import { memo } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

export const PlayerCard = memo(function PlayerCard({
  gameStatus,
  isCurrentPlayerModerator,
  player,
  currentPlayerId,
  onRemovePlayer,
}: {
  gameStatus: Status;
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
      className={`flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-card-foreground max-w-content transition-opacity duration-200 ease-out ${cardOpacityClass}`}
    >
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
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            {t('playerCard.removeButton')}
          </Button>
        )}
      </div>
    </div>
  );
});
