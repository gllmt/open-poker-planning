'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { fetchGameState, joinGame } from '@/lib/api/games';
import {
  getCurrentPlayerId,
  getRecentPlayerName,
  setRecentPlayerName,
  upsertPlayerGame,
} from '@/lib/browser-storage';

export function JoinGame({ initialGameId }: { initialGameId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialToken = useMemo(
    () => searchParams.get('token') || '',
    [searchParams]
  );

  const [joinGameId, setJoinGameId] = useState(initialGameId || '');
  const [inviteToken, setInviteToken] = useState(initialToken);
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const recent = getRecentPlayerName();
    if (recent && !playerName) setPlayerName(recent);
  }, [playerName]);

  useEffect(() => {
    if (!joinGameId) return;
    const existingPlayerId = getCurrentPlayerId(joinGameId);
    if (!existingPlayerId) return;

    fetchGameState({ gameId: joinGameId, playerId: existingPlayerId })
      .then(() => router.push(`/game/${joinGameId}`))
      .catch(() => {});
  }, [joinGameId, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { playerId } = await joinGame(joinGameId, inviteToken, playerName);
      setRecentPlayerName(playerName);

      // We don’t know the full game metadata yet; it will be fetched on the game page.
      upsertPlayerGame({
        id: joinGameId,
        name: joinGameId,
        createdBy: '',
        createdById: '',
        playerId,
        joinToken: inviteToken,
      });

      router.push(`/game/${joinGameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="w-full flex justify-center">
        <div className="w-full max-w-lg dark:bg-gray-900 bg-white rounded-[18px] shadow-[0_4px_16px_#00000029] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)] p-6">
          <h2 className="text-2xl font-bold mb-4 text-center">
            Join a Session
          </h2>

          <div className="flex flex-col gap-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="sessionId"
              >
                Session ID
              </label>
              <input
                id="sessionId"
                required
                type="text"
                className="w-full border border-gray-400 dark:border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-900"
                placeholder="UUID…"
                value={joinGameId}
                onChange={(e) => setJoinGameId(e.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="inviteToken"
              >
                Invite token
              </label>
              <input
                id="inviteToken"
                required
                type="text"
                className="w-full border border-gray-400 dark:border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-900"
                placeholder="Paste the token from the invite link"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1"
                htmlFor="playerName"
              >
                Your Name
              </label>
              <input
                id="playerName"
                required
                type="text"
                className="w-full border border-gray-400 dark:border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-gray-900"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>

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
              {loading ? 'Joining…' : 'Join'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
