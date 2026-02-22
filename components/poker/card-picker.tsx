'use client';

import { Check, CircleQuestionMark, Coffee } from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@/components/i18n/use-i18n';
import type { CardConfig } from '@/types/cards';
import type { Game } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';
import { getCards, normalizeLegacyCards } from './card-configs';

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
  const canVote = game.gameStatus !== Status.Finished;

  return (
    <section
      className={`animate-fade-in-down rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm transition-opacity ${
        canVote ? 'opacity-100' : 'pointer-events-none opacity-70'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-muted-foreground text-sm font-semibold tracking-wide">
          {canVote ? t('cardPicker.cta') : t('cardPicker.notReady')}
        </h3>
        {currentValue !== undefined && canVote && (
          <span
            className="text-primary inline-flex items-center gap-1 text-sm font-semibold"
            aria-live="polite"
          >
            <Check className="size-4" aria-hidden="true" />
            {currentValue}
          </span>
        )}
      </div>
      {error && (
        <output
          aria-live="polite"
          className="text-destructive mb-3 block rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs"
        >
          {error}
        </output>
      )}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {cards.map((card) => {
          const isSelected = currentValue === card.value;
          return (
            <button
              key={card.value}
              type="button"
              aria-pressed={isSelected}
              disabled={!canVote}
              className={`focus-visible:ring-primary/45 relative flex h-24 w-16 shrink-0 touch-manipulation flex-col items-center justify-center rounded-xl border-2 font-semibold shadow-sm transition-[transform,border-color,box-shadow,opacity] duration-200 ease-out focus-visible:ring-2 focus-visible:outline-none sm:h-28 sm:w-20 ${
                isSelected
                  ? 'border-primary bg-primary/10 -translate-y-1 shadow-md'
                  : 'border-border/80 hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-md'
              } ${!canVote ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              style={{ backgroundColor: card.color }}
              onClick={() => {
                if (isSelected) return;
                play(card);
              }}
            >
              {card.value >= 0 && (
                <div className="flex h-full w-full flex-col justify-between p-1 text-slate-900">
                  <span className="text-[11px] leading-none">
                    {card.displayValue}
                  </span>
                  <span
                    className={`${card.displayValue.length < 2 ? 'text-3xl' : 'text-2xl'} leading-none`}
                  >
                    {card.displayValue}
                  </span>
                  <span className="text-[11px] leading-none text-right">
                    {card.displayValue}
                  </span>
                </div>
              )}
              {card.value === -1 && (
                <Coffee className="size-8 text-slate-900" aria-hidden="true" />
              )}
              {card.value === -2 && (
                <CircleQuestionMark
                  className="size-8 text-slate-900"
                  aria-hidden="true"
                />
              )}
              {isSelected && (
                <span className="bg-primary text-primary-foreground absolute -right-2 -top-2 inline-flex size-6 items-center justify-center rounded-full shadow">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
