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

  return (
    <div className="w-full max-w-full animate-fade-in-down">
      <div className="text-center text-lg font-semibold my-4">
        {game.gameStatus !== Status.Finished
          ? t('cardPicker.cta')
          : t('cardPicker.notReady')}
      </div>
      {error && (
        <div className="text-center text-destructive text-xs -mt-2 mb-2">
          {error}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-4 py-4">
        {cards.map((card) => {
          const isSelected = currentValue === card.value;
          return (
            <button
              key={card.value}
              type="button"
              aria-pressed={isSelected}
              disabled={game.gameStatus === Status.Finished}
              className={`
                cursor-pointer select-none transition-all duration-300 ease-out will-change-transform
                rounded-xl border-2 border-transparent bg-card shadow-[var(--shadow-sm)] text-slate-800
                flex flex-col items-center justify-center
                hover:-translate-y-0.5 hover:scale-[1.04] hover:shadow-[var(--shadow-md)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
                w-20 h-[110px] md:w-[120px] md:h-[168px]
                ${
                  isSelected
                    ? 'ring-2 ring-primary -translate-y-1 shadow-[0_4px_20px_var(--color-primary)/25]'
                    : ''
                }
                ${game.gameStatus === Status.Finished ? 'opacity-50 cursor-not-allowed' : ''}
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
