'use client';

import { CircleQuestionMark, Coffee } from 'lucide-react';
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

  const isFinished = game.gameStatus === Status.Finished;

  return (
    <div className="w-full max-w-4xl">
      <div className="text-center text-lg font-semibold my-4">
        <span
          key={isFinished ? 'finished' : 'active'}
          className="inline-block animate-fade-in"
        >
          {!isFinished ? t('cardPicker.cta') : t('cardPicker.notReady')}
        </span>
      </div>
      {error && (
        <div className="text-center text-destructive text-xs -mt-2 mb-2">
          {error}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3 py-4 md:gap-6">
        {cards.map((card) => {
          const isSelected = currentValue === card.value;
          const isDisabled = isFinished;
          const baseClasses = `
            relative
            flex h-[110px] w-20 flex-col items-center justify-center
            rounded-xl border-2 border-transparent
            text-slate-900 shadow-sm
            select-none
            transform-gpu
            transition-transform transition-shadow transition-opacity
            duration-300 ease-out
            dark:text-white
            md:h-[180px] md:w-[130px]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
          `;

          const interactiveClasses = !isDisabled
            ? `
              cursor-pointer
              hover:-translate-y-1 hover:scale-[1.03] hover:shadow-md
              active:scale-[0.98]
            `
            : `
              cursor-not-allowed opacity-50
            `;

          const selectedClasses = isSelected
            ? `
              ring-4 ring-primary/70 shadow-lg
              -translate-y-1 scale-[1.03]
              dark:ring-primary/80
            `
            : '';

          return (
            <button
              key={card.value}
              type="button"
              aria-pressed={isSelected}
              disabled={isDisabled}
              className={`${baseClasses} ${interactiveClasses} ${selectedClasses}`}
              style={{ backgroundColor: card.color }}
              onClick={() => {
                if (isSelected || isDisabled) return;
                play(card);
              }}
            >
              <div className="flex h-full w-full flex-col justify-between p-1">
                {card.value >= 0 && (
                  <>
                    <span className="flex justify-start text-xs">
                      {card.displayValue}
                    </span>
                    <span
                      className={
                        card.displayValue.length < 2 ? 'text-4xl' : 'text-3xl'
                      }
                    >
                      {card.displayValue}
                    </span>
                    <span className="flex w-full justify-end text-xs">
                      {card.displayValue}
                    </span>
                  </>
                )}

                {card.value === -1 && (
                  <span className="flex h-full w-full flex-col justify-center text-4xl">
                    <Coffee className="size-9 w-full" aria-hidden="true" />
                  </span>
                )}

                {card.value === -2 && (
                  <span className="flex h-full w-full flex-col justify-center text-4xl">
                    <CircleQuestionMark
                      className="size-9 w-full"
                      aria-hidden="true"
                    />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
