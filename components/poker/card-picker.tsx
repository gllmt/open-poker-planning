'use client';

import type { CSSProperties } from 'react';
import { useMemo } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { cn } from '@/lib/utils';
import type { CardConfig } from '@/types/cards';
import type { Game } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { getCards, normalizeLegacyCards } from './card-configs';
import { PlanningCard } from './planning-card';

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
  const cards = useMemo(() => {
    const baseCards = game.cards?.length ? game.cards : getCards(game.gameType);
    return normalizeLegacyCards(game.gameType, baseCards);
  }, [game.cards, game.gameType]);
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
    <div className="relative isolate my-4 w-full max-w-5xl overflow-hidden rounded-[2rem] border border-primary/15 bg-[radial-gradient(circle_at_50%_0%,rgba(251,146,60,0.12),transparent_38%),radial-gradient(circle_at_82%_75%,rgba(245,158,11,0.08),transparent_30%)] px-3 py-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)] md:px-6 md:py-8 dark:bg-[radial-gradient(circle_at_50%_0%,rgba(251,146,60,0.12),transparent_38%),radial-gradient(circle_at_82%_75%,rgba(245,158,11,0.1),transparent_34%)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-50"
      >
        <span className="absolute left-[8%] top-[18%] size-1 rounded-full bg-primary/50 shadow-[0_0_12px_rgba(251,146,60,0.55)]" />
        <span className="absolute right-[11%] top-[28%] size-1 rounded-full bg-amber-400/45 shadow-[0_0_12px_rgba(251,191,36,0.45)]" />
        <span className="absolute bottom-[14%] left-[28%] size-0.5 rounded-full bg-primary/55" />
      </div>
      <div className="mb-5 text-center md:mb-7">
        <span
          key={isFinished ? 'finished' : 'active'}
          className="inline-block animate-fade-in text-sm font-semibold uppercase tracking-[0.16em] text-foreground md:text-base"
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
                'relative rounded-[0.85rem] outline-none transition-[translate,rotate,scale,filter] duration-300 ease-out md:rounded-[1.1rem]',
                !isDisabled &&
                  'cursor-pointer hover:-translate-y-2 hover:drop-shadow-[0_18px_18px_rgba(15,10,25,0.24)] active:translate-y-0 active:scale-[0.97]',
                !isSelected &&
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400/70',
                isDisabled && 'cursor-default',
                isSelected && '-translate-y-1'
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
                backLabel={t('cardPicker.validated')}
                className="animate-planning-card-deal"
              />
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute -inset-1 rounded-[1rem] border border-orange-300/75 opacity-0 scale-[0.97] transition-[opacity,scale,box-shadow] duration-300 ease-out md:rounded-[1.25rem]',
                  isSelected &&
                    'scale-100 opacity-100 shadow-[0_0_20px_rgba(249,115,22,0.3)]'
                )}
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
