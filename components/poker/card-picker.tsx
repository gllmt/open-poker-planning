'use client';

import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { getCards } from './card-configs';
import { PlanningCard } from './planning-card';
import { useI18n } from '@/components/i18n/use-i18n';
import { cn } from '@/lib/utils';
import type { CardConfig } from '@/types/cards';
import type { Game } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

export function CardPicker({
  game,
  players,
  currentPlayerId,
  onVote,
  error,
}: {
  game: Game;
  players: Player[];
  currentPlayerId: string;
  onVote: (value: number, emoji?: string) => void;
  error?: string | null;
}) {
  const { t } = useI18n();
  const cards = game.cards?.length ? game.cards : getCards(game.gameType);
  const currentValue = useMemo(() => {
    const currentPlayer = players.find((p) => p.id === currentPlayerId);
    return currentPlayer?.status === Status.Finished
      ? currentPlayer.value
      : undefined;
  }, [players, currentPlayerId]);

  const play = (card: CardConfig) => {
    if (game.gameStatus === Status.Finished) return;
    onVote(card.value, card.value === -1 ? 'coffee' : undefined);
  };

  const isFinished = game.gameStatus === Status.Finished;

  return (
    <div className="relative isolate my-4 w-full max-w-5xl overflow-hidden rounded-table border border-primary/15 poker-table-surface px-3 py-6 shadow-table md:px-6 md:py-8 dark:poker-table-surface-dark">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-50"
      >
        <span className="absolute left-[8%] top-[18%] size-1 rounded-full bg-primary/50 shadow-spark-primary" />
        <span className="absolute right-[11%] top-[28%] size-1 rounded-full bg-card-spark/45 shadow-spark-secondary" />
        <span className="absolute bottom-[14%] left-[28%] size-0.5 rounded-full bg-primary/55" />
      </div>
      <div className="mb-5 text-center md:mb-7">
        <span
          key={isFinished ? 'finished' : 'active'}
          className="inline-block animate-fade-in text-sm font-semibold uppercase tracking-card-label text-foreground md:text-base"
        >
          {!isFinished ? t('cardPicker.cta') : t('cardPicker.notReady')}
        </span>
        <div className="mx-auto mt-2 h-px w-24 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      </div>
      {error && (
        <div
          className="mb-3 -mt-2 text-center text-xs text-destructive"
          role="alert"
        >
          {error}
        </div>
      )}
      <fieldset
        className="flex flex-wrap justify-center gap-x-3 gap-y-5 md:gap-x-5 md:gap-y-7"
        aria-label={isFinished ? t('cardPicker.notReady') : t('cardPicker.cta')}
      >
        {cards.map((card, index) => {
          const isSelected = currentValue === card.value;
          const isDisabled = isFinished;
          const cardLabel = isSelected
            ? t('cardPicker.selectedCard', { value: card.displayValue })
            : isFinished
              ? t('cardPicker.revealedCard', { value: card.displayValue })
              : t('cardPicker.selectCard', { value: card.displayValue });

          return (
            <button
              key={card.value}
              type="button"
              aria-label={cardLabel}
              aria-pressed={isSelected}
              disabled={isDisabled}
              className={cn(
                'relative rounded-card-control outline-none transition-card-control duration-300 ease-out md:rounded-card-control-lg',
                !isDisabled && 'cursor-pointer',
                !isDisabled &&
                  !isSelected &&
                  'hover:-translate-y-2 hover:drop-shadow-card-hover active:translate-y-0 active:scale-[0.97]',
                !isSelected &&
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card-focus/70',
                isDisabled && 'cursor-default',
                isSelected && 'z-10 -translate-y-4'
              )}
              style={
                {
                  '--planning-card-delay': `${Math.min(index, 8) * 45}ms`,
                } as CSSProperties
              }
              onClick={() => {
                if (isSelected || isDisabled) return;
                play(card);
              }}
            >
              <PlanningCard
                card={card}
                face={isSelected && !isFinished ? 'back' : 'front'}
                selected={isSelected}
                className="animate-planning-card-deal"
              />
            </button>
          );
        })}
      </fieldset>
      <p
        className="mt-5 min-h-5 text-center text-xs text-muted-foreground"
        aria-live="polite"
      >
        {currentValue !== undefined && !isFinished
          ? t('cardPicker.changeVote')
          : ''}
      </p>
    </div>
  );
}
