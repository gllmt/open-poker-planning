'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { fetchGameState } from '@/lib/api/games';
import { getCurrentPlayerId, getPlayerGamesFromCache, upsertPlayerGame } from '@/lib/browser-storage';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { Loading } from '@/components/ui/loading';

import { GameArea } from './game-area';

export function Poker({ gameId }: { gameId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    const playerId = getCurrentPlayerId(gameId);
    if (!playerId) {
      router.push(`/join/${gameId}`);
      return;
    }

    setCurrentPlayerId(playerId);

    try {
      const { game, players } = await fetchGameState({ gameId, playerId });
      setGame(game);
      setPlayers(players);

      // Keep recent games metadata up-to-date
      const cached = getPlayerGamesFromCache().find((g) => g.id === gameId);
      upsertPlayerGame({
        id: game.id,
        name: game.name,
        createdBy: game.createdBy,
        createdById: game.createdById,
        playerId,
        joinToken: cached?.joinToken,
        isAllowMembersToManageSession: game.isAllowMembersToManageSession,
      });
    } catch {
      router.push(`/join/${gameId}`);
    } finally {
      setLoading(false);
    }
  }, [gameId, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase.channel(`game:${gameId}`, {
      config: { broadcast: { ack: false, self: true } },
    });

    channel.on('broadcast', { event: 'game_changed' }, () => {
      refresh();
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, gameId, refresh]);

  useEffect(() => {
    if (!players || !currentPlayerId) return;
    const stillInGame = players.some((p) => p.id === currentPlayerId);
    if (!stillInGame) router.push(`/join/${gameId}`);
  }, [players, currentPlayerId, router, gameId]);

  if (loading) {
    return (
      <div className='flex items-center justify-center p-10'>
        <Loading />
      </div>
    );
  }

  if (!game || !players || !currentPlayerId) {
    return (
      <div className='p-6 text-center'>
        <p className='text-sm'>Game not found</p>
      </div>
    );
  }

  return <GameArea game={game} players={players} currentPlayerId={currentPlayerId} />;
}

