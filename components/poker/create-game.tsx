'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { createGame } from '@/lib/api/games';
import {
  getRecentPlayerName,
  setRecentPlayerName,
  upsertPlayerGame,
} from '@/lib/browser-storage';
import { GameType, type NewGame } from '@/types/game';
import { getCards, getCustomCards } from './card-configs';

export function CreateGame() {
  const router = useRouter();

  const [gameName, setGameName] = useState('New session');
  const [createdBy, setCreatedBy] = useState<string>('');
  const [gameType, setGameType] = useState<GameType>(GameType.Fibonacci);
  const [allowMembersToManageSession, setAllowMembersToManageSession] =
    useState(false);
  const [customOptions, setCustomOptions] = useState(Array(15).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const recent = getRecentPlayerName();
    if (recent && !createdBy) setCreatedBy(recent);
  }, [createdBy]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (gameType === GameType.Custom) {
      const count = customOptions.reduce(
        (acc, option) => (option?.trim() ? acc + 1 : acc),
        0
      );
      if (count < 2) {
        setError('Please enter at least two custom options.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: NewGame = {
        name: gameName,
        createdBy,
        gameType,
        isAllowMembersToManageSession: allowMembersToManageSession,
        cards:
          gameType === GameType.Custom
            ? getCustomCards(customOptions)
            : getCards(gameType),
      };

      const { gameId, joinToken, playerId } = await createGame(payload);

      setRecentPlayerName(createdBy);
      upsertPlayerGame({
        id: gameId,
        name: gameName,
        createdBy,
        createdById: playerId,
        playerId,
        joinToken,
        isAllowMembersToManageSession: allowMembersToManageSession,
      });

      router.push(`/game/${gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomOptionChange = (index: number, value: string) => {
    const next = [...customOptions];
    next[index] = value;
    setCustomOptions(next);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex justify-center">
      <div className="w-full max-w-lg dark:bg-gray-900 bg-white rounded-[18px] shadow-[0_4px_16px_#00000029] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)] p-6">
        <h2 className="text-2xl font-semibold mb-4 text-center">
          Create new session
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="gameName"
            >
              Session name
            </label>
            <input
              id="gameName"
              required
              type="text"
              className="w-full border border-gray-400 dark:border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-900"
              value={gameName}
              onChange={(event) => setGameName(event.target.value)}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              htmlFor="createdBy"
            >
              Your name
            </label>
            <input
              id="createdBy"
              required
              type="text"
              className="w-full border border-gray-400 dark:border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-900"
              value={createdBy}
              onChange={(event) => setCreatedBy(event.target.value)}
            />
          </div>

          <fieldset>
            <legend className="block text-sm font-medium mb-2">
              Session sizing type
            </legend>
            <div className="flex flex-col gap-2">
              {[
                { type: GameType.Fibonacci, label: 'Fibonacci' },
                { type: GameType.ShortFibonacci, label: 'Short Fibonacci' },
                { type: GameType.TShirt, label: 'T-Shirt' },
                { type: GameType.TShirtAndNumber, label: 'T-Shirt & Numbers' },
                { type: GameType.Custom, label: 'Custom' },
              ].map(({ type, label }) => (
                <label key={type} className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-blue-600"
                    name="gameType"
                    value={type}
                    checked={gameType === type}
                    onChange={() => setGameType(type)}
                  />
                  <span className="ml-2">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {gameType === GameType.Custom && (
            <div className="flex flex-wrap gap-2 mb-2">
              {customOptions.map((option, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength={3}
                  className="w-12 border rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900"
                  value={option}
                  onChange={(event) =>
                    handleCustomOptionChange(index, event.target.value)
                  }
                />
              ))}
            </div>
          )}

          <label className="inline-flex items-center mt-2">
            <input
              type="checkbox"
              className="form-checkbox text-blue-600"
              checked={allowMembersToManageSession}
              onChange={() => setAllowMembersToManageSession((v) => !v)}
            />
            <span className="ml-2">Allow members to manage session</span>
          </label>

          {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="submit"
            className={`px-[15px] py-[7px] rounded-[980px] bg-[#0071e3] text-white border border-transparent shadow-[2px_6px_14px_#0000001f] transition-all duration-300 ease-[cubic-bezier(0,0,0.5,1)] will-change-transform hover:bg-[#1a7ff0] hover:shadow-[2px_10px_22px_#00000033] hover:scale-[1.035] cursor-pointer ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </form>
  );
}
