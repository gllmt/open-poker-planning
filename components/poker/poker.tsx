'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Loading } from '@/components/ui/loading';
import { fetchGameState, vote } from '@/lib/api/games';
import {
  getCurrentPlayerId,
  getPlayerGamesFromCache,
  upsertPlayerGame,
} from '@/lib/browser-storage';
import { withLocale } from '@/lib/i18n/paths';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Game } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { GameArea } from './game-area';

type PendingVote = {
  value: number;
  emoji?: string;
};

export function Poker({ gameId }: { gameId: string }) {
  const router = useRouter();
  const { locale, t } = useI18n();

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | undefined>(
    undefined
  );
  const [voteError, setVoteError] = useState<string | null>(null);

  const pendingVoteRef = useRef<PendingVote | null>(null);
  const voteDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const voteRequestIdRef = useRef(0);
  const refreshRequestIdRef = useRef(0);

  const clearPendingVote = useCallback(() => {
    pendingVoteRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestIdRef.current;
    const playerId = getCurrentPlayerId(gameId);
    if (!playerId) {
      if (refreshRequestIdRef.current === requestId)
        router.push(withLocale(`/join/${gameId}`, locale));
      return;
    }

    setCurrentPlayerId(playerId);

    try {
      const { game: serverGame, players: serverPlayers } = await fetchGameState(
        { gameId, playerId }
      );
      if (refreshRequestIdRef.current !== requestId) return;
      let nextPlayers = serverPlayers;
      const pendingVote = pendingVoteRef.current;

      if (pendingVote) {
        const me = nextPlayers.find((p) => p.id === playerId);
        const synced =
          me?.status === Status.Finished &&
          me.value === pendingVote.value &&
          (pendingVote.value !== -1 || me.emoji === pendingVote.emoji);

        if (synced) {
          pendingVoteRef.current = null;
        } else {
          nextPlayers = nextPlayers.map((p) =>
            p.id === playerId
              ? {
                  ...p,
                  value: pendingVote.value,
                  emoji: pendingVote.emoji,
                  status: Status.Finished,
                }
              : p
          );
        }
      }

      setGame(serverGame);
      setPlayers(nextPlayers);

      // Keep recent games metadata up-to-date
      const cached = getPlayerGamesFromCache().find((g) => g.id === gameId);
      upsertPlayerGame({
        id: serverGame.id,
        name: serverGame.name,
        createdBy: serverGame.createdBy,
        createdById: serverGame.createdById,
        playerId,
        joinToken: cached?.joinToken,
        isAllowMembersToManageSession: serverGame.isAllowMembersToManageSession,
      });
    } catch {
      if (refreshRequestIdRef.current === requestId)
        router.push(withLocale(`/join/${gameId}`, locale));
    } finally {
      if (refreshRequestIdRef.current === requestId) setLoading(false);
    }
  }, [gameId, router, locale]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`game:${gameId}`, {
      config: { broadcast: { ack: false, self: true } },
    });

    channel.on('broadcast', { event: 'game_changed' }, ({ payload }) => {
      const payloadType = (payload as { type?: unknown } | null)?.type;
      if (payloadType === 'reset') {
        clearPendingVote();
      }
      refresh();
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, refresh, clearPendingVote]);

  useEffect(() => {
    if (!players || !currentPlayerId) return;
    const stillInGame = players.some((p) => p.id === currentPlayerId);
    if (!stillInGame) router.push(withLocale(`/join/${gameId}`, locale));
  }, [players, currentPlayerId, router, gameId, locale]);

  useEffect(() => {
    return () => {
      if (voteDebounceTimeoutRef.current)
        clearTimeout(voteDebounceTimeoutRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loading />
      </div>
    );
  }

  if (!game || !players || !currentPlayerId) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm">{t('game.gameNotFound')}</p>
      </div>
    );
  }

  const onVote = (value: number, emoji?: string) => {
    if (game.gameStatus === Status.Finished) return;

    pendingVoteRef.current = { value, emoji };
    setVoteError(null);

    setPlayers((prev) => {
      if (!prev) return prev;
      return prev.map((p) =>
        p.id === currentPlayerId
          ? { ...p, value, emoji, status: Status.Finished }
          : p
      );
    });

    if (voteDebounceTimeoutRef.current)
      clearTimeout(voteDebounceTimeoutRef.current);

    const requestId = ++voteRequestIdRef.current;
    const playerId = currentPlayerId;

    voteDebounceTimeoutRef.current = setTimeout(() => {
      const pendingVote = pendingVoteRef.current;
      if (!pendingVote || !playerId) return;

      vote(gameId, playerId, pendingVote.value, pendingVote.emoji).catch(
        (e) => {
          if (voteRequestIdRef.current !== requestId) return;
          pendingVoteRef.current = null;
          setVoteError(e instanceof Error ? e.message : t('game.voteFailed'));
          refresh().catch(() => {});
        }
      );
    }, 150);
  };

  return (
    <GameArea
      game={game}
      players={players}
      currentPlayerId={currentPlayerId}
      onVote={onVote}
      voteError={voteError}
    />
  );
}
