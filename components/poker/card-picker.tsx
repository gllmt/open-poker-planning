'use client';

import { useMemo } from 'react';
import type { CardConfig } from '@/types/cards';
import type { Game } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { getCards, getRandomEmoji } from './card-configs';

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
  const randomEmoji = useMemo(() => {
    const seed = `${game.id}:${game.updatedAt || ''}:${currentPlayerId}:${game.gameStatus}`;
    return pickEmoji(seed);
  }, [game.id, game.updatedAt, currentPlayerId, game.gameStatus]);

  const cards = game.cards?.length ? game.cards : getCards(game.gameType);
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const currentValue =
    currentPlayer?.status === Status.Finished ? currentPlayer.value : undefined;

  const play = (card: CardConfig) => {
    if (game.gameStatus === Status.Finished) return;
    onVote(card.value, card.value === -1 ? randomEmoji : undefined);
  };

  return (
    <div className="w-full max-w-full animate-fade-in-down">
      <div className="text-center text-lg font-semibold my-4">
        {game.gameStatus !== Status.Finished
          ? 'Click on the card to vote'
          : 'Session not ready for voting! Wait for moderator to start'}
      </div>
      {error && (
        <div className="text-center text-destructive text-xs -mt-2 mb-2">
          {error}
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-6 py-4">
        {cards.map((card) => {
          const isSelected = currentValue === card.value;
          return (
            <button
              key={card.value}
              type="button"
              aria-pressed={isSelected}
              disabled={game.gameStatus === Status.Finished}
              className={`
                cursor-pointer select-none transition-all duration-300
                rounded-md border border-border bg-card text-foreground shadow-sm
                flex flex-col items-center justify-center
                hover:scale-110 hover:shadow-md
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
                w-16 h-24 md:w-20 md:h-30
                ${isSelected ? 'border-primary/60 ring-primary/30 border-2 ring-2 z-10 scale-110 shadow-md' : ''}
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
                    <span className="text-xs text-foreground flex justify-start">
                      {card.displayValue}
                    </span>
                    <span
                      className={`${card.displayValue.length < 2 ? 'text-4xl' : 'text-3xl'}`}
                    >
                      {card.displayValue}
                    </span>
                    <span className="flex justify-end w-full text-xs text-foreground">
                      {card.displayValue}
                    </span>
                  </>
                )}
                {card.value === -1 && (
                  <span className="flex flex-col justify-center h-full text-4xl">
                    {randomEmoji}
                  </span>
                )}
                {card.value === -2 && (
                  <span className="flex flex-col justify-center h-full text-4xl">
                    ❓
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

function pickEmoji(seed: string) {
  const emojis = [
    '☕',
    '🥤',
    '🍹',
    '🍸',
    '🍧',
    '🍨',
    '🍩',
    '🍎',
    '🧁',
    '🍪',
    '🍿',
    '🌮',
    '🍦',
    '🍉',
    '🍐',
    '🍰',
    '🍫',
  ];
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = (hash * 33) ^ seed.charCodeAt(i);
  const index = Math.abs(hash) % emojis.length;
  return emojis[index] || getRandomEmoji();
}
