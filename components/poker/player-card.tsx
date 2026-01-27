'use client';

import { Check, CircleUserRound } from 'lucide-react';
import { memo } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { removePlayer } from '@/lib/api/games';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

export const PlayerCard = memo(function PlayerCard({
  gameId,
  gameStatus,
  isCurrentPlayerModerator,
  player,
  currentPlayerId,
}: {
  gameId: string;
  gameStatus: Status;
  isCurrentPlayerModerator: boolean;
  player: Player;
  currentPlayerId: string;
}) {
  const { t } = useI18n();
  const canRemove = isCurrentPlayerModerator && player.id !== currentPlayerId;

  const onRemove = async () => {
    await removePlayer(gameId, player.id, currentPlayerId);
  };

  const hasVoted = player.status === Status.Finished;

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
        {gameStatus !== Status.Finished && (
          <span className="flex size-5 items-center justify-center">
            {hasVoted ? (
              <Check className="size-4 text-emerald-500" aria-hidden="true" />
            ) : null}
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
