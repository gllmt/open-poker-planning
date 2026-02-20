'use client';

import { memo } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

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

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-card-foreground max-w-content transition-opacity duration-200 ease-out ${cardOpacityClass}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar size="sm" className="shrink-0">
          <AvatarImage src={undefined} alt={player.name} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {getInitials(player.name)}
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
            <span
              className={`size-2 rounded-full bg-primary transition-all duration-200 ${
                hasVoted ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
              }`}
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
