'use client';

import { CircleUserRound, X } from 'lucide-react';
import { memo } from 'react';
import { sileo } from 'sileo';
import { PlanningCard } from './planning-card';
import { useI18n } from '@/components/i18n/use-i18n';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { CardConfig } from '@/types/cards';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

export const PlayerCard = memo(function PlayerCard({
  gameStatus,
  canRemove,
  player,
  card,
  revealDelayMs,
  onRemovePlayer,
}: {
  gameStatus: Status;
  canRemove: boolean;
  player: Player;
  card?: CardConfig;
  revealDelayMs: number;
  onRemovePlayer: (playerId: string) => Promise<void>;
}) {
  const { t } = useI18n();

  const onRemove = async () => {
    try {
      await onRemovePlayer(player.id);
    } catch {
      sileo.info({ title: t('game.actionFailed'), position: 'top-center' });
    }
  };

  const hasVoted = player.status === Status.Finished;
  const isRevealed = gameStatus === Status.Finished;
  const isDimmed = gameStatus !== Status.Finished && !hasVoted;
  const cardOpacityClass = isDimmed ? 'opacity-60' : 'opacity-100';
  const voteState = !hasVoted ? 'waiting' : isRevealed ? 'revealed' : 'hidden';
  const statusLabel =
    voteState === 'waiting'
      ? t('playerCard.waiting')
      : voteState === 'revealed'
        ? t('playerCard.revealed', {
            value: card?.displayValue ?? player.value ?? '-',
          })
        : t('playerCard.voted');

  return (
    <div
      data-vote-state={voteState}
      className={`flex w-full items-center justify-between gap-3 rounded-xl glass-inner dark:dark-glass-inner px-3 py-2 text-card-foreground transition duration-200 ease-out hover:bg-accent/40 dark:hover:bg-accent/20 ${cardOpacityClass}`}
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
          <div className="mt-0.5 truncate text-status text-muted-foreground">
            {statusLabel}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canRemove && (
          <Button
            type="button"
            title={t('playerCard.removeTitle')}
            aria-label={t('playerCard.removeButton')}
            variant="outline"
            size="icon-xs"
            className="text-destructive hover:text-destructive"
            onClick={() => void onRemove()}
          >
            <X aria-hidden="true" />
          </Button>
        )}
        <span title={statusLabel}>
          <PlanningCard
            card={card}
            face={!hasVoted ? 'empty' : isRevealed ? 'front' : 'back'}
            size="player"
            flipDelayMs={isRevealed ? revealDelayMs : 0}
          />
        </span>
      </div>
    </div>
  );
});
