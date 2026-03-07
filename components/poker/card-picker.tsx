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
      <div className="flex flex-wrap justify-center gap-3 md:gap-6 py-4">
        {cards.map((card) => {
          const isSelected = currentValue === card.value;
          return (
            <button
              key={card.value}
              type="button"
              aria-pressed={isSelected}
              disabled={isFinished}
              className={`
                cursor-pointer select-none will-change-transform
                rounded-xl border-2 border-transparent shadow-sm text-slate-900 dark:text-white
                flex flex-col items-center justify-center
                transition-[transform,box-shadow,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                hover:-translate-y-1 hover:scale-[1.03] hover:shadow-md
                active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
                w-20 h-[110px] md:w-[130px] md:h-[180px]
                ${
                  isSelected
                    ? 'ring-4 ring-primary/70 dark:ring-primary/80 -translate-y-1.5 scale-[1.03] shadow-lg'
                    : ''
                }
                ${isFinished ? 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:scale-100 hover:shadow-sm active:scale-100' : ''}
              `}
              style={{ backgroundColor: card.color }}
              onClick={() => {
                if (isSelected) return;
                play(card);
              }}
            >
              <div className="flex flex-col justify-between h-full w-full p-1">
                {card.value >= 0 && (
                  <>
                    <span className="text-xs flex justify-start">
                      {card.displayValue}
                    </span>
                    <span
                      className={`${card.displayValue.length < 2 ? 'text-4xl' : 'text-3xl'}`}
                    >
                      {card.displayValue}
                    </span>
                    <span className="flex justify-end w-full text-xs">
                      {card.displayValue}
                    </span>
                  </>
                )}
                {card.value === -1 && (
                  <span className="flex flex-col justify-center h-full w-full text-4xl">
                    <Coffee className="size-9 w-full" aria-hidden="true" />
                  </span>
                )}
                {card.value === -2 && (
                  <span className="flex flex-col justify-center h-full w-full text-4xl">
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
