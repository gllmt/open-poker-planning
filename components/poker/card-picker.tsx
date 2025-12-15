'use client';

import { useMemo } from 'react';

import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { Status } from '@/types/status';

import type { CardConfig } from '@/types/cards';

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
  const currentValue = currentPlayer?.status === Status.Finished ? currentPlayer.value : undefined;

  const play = (card: CardConfig) => {
    if (game.gameStatus === Status.Finished) return;
    onVote(card.value, card.value === -1 ? randomEmoji : undefined);
  };

  return (
    <div className='w-full max-w-full animate-fade-in-down'>
      <div className='text-center text-lg font-semibold my-4'>
        {game.gameStatus !== Status.Finished
          ? 'Click on the card to vote'
          : 'Session not ready for voting! Wait for moderator to start'}
      </div>
      {error && <div className='text-center text-red-600 text-xs -mt-2 mb-2'>{error}</div>}
      <div className='flex flex-wrap justify-center gap-6 py-4'>
        {cards.map((card) => {
          const isSelected = currentValue === card.value;
          return (
            <div
              key={card.value}
              className={`
                cursor-pointer select-none transition-all duration-300
                rounded shadow-md border border-gray-300
                flex flex-col items-center justify-center
                bg-white text-gray-800
                hover:scale-110
                w-16 h-24 md:w-20 md:h-30
                ${isSelected ? 'border-dashed border-2 border-gray-800 z-10 shadow-lg scale-110' : 'shadow-md'}
                ${game.gameStatus === Status.Finished ? 'pointer-events-none opacity-50 cursor-not-allowed' : ''}
              `}
              style={{ backgroundColor: card.color }}
              onClick={() => {
                if (isSelected) return;
                play(card);
              }}
            >
              <div className='flex flex-col justify-between h-full w-full p-1'>
                {card.value >= 0 && (
                  <>
                    <span className='text-xs text-gray-800 flex justify-start'>{card.displayValue}</span>
                    <span className={`${card.displayValue.length < 2 ? 'text-4xl' : 'text-3xl'}`}>{card.displayValue}</span>
                    <span className='flex justify-end w-full text-xs text-gray-800'>{card.displayValue}</span>
                  </>
                )}
                {card.value === -1 && <span className='flex flex-col justify-center h-full text-4xl'>{randomEmoji}</span>}
                {card.value === -2 && <span className='flex flex-col justify-center h-full text-4xl'>❓</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pickEmoji(seed: string) {
  const emojis = ['☕', '🥤', '🍹', '🍸', '🍧', '🍨', '🍩', '🍎', '🧁', '🍪', '🍿', '🌮', '🍦', '🍉', '🍐', '🍰', '🍫'];
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = (hash * 33) ^ seed.charCodeAt(i);
  const index = Math.abs(hash) % emojis.length;
  return emojis[index] || getRandomEmoji();
}
