'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Loading } from '@/components/ui/loading';
import {
  fetchGameState,
  reset,
  reveal,
  updateTimer,
  vote,
} from '@/lib/api/games';
import {
  getCurrentPlayerId,
  getPlayerGamesFromCache,
  upsertPlayerGame,
} from '@/lib/browser-storage';
import { withLocale } from '@/lib/i18n/paths';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { resetTimerProps } from '@/lib/timer/reset-timer-props';
import type { Game, TimerProps } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { GameArea } from './game-area';
import { isTieResult } from './hooks/use-confetti';

type PendingVote = {
  value: number;
  emoji?: string;
};

type VoteBroadcastPayload = {
  type: 'vote';
  player: {
    id: string;
    status: Status;
    value?: number;
    emoji?: string;
  };
  game?: {
    gameStatus?: Status;
    timerProps?: TimerProps | null;
  };
};

const isStatusValue = (value: unknown): value is Status =>
  value === Status.NotStarted ||
  value === Status.Started ||
  value === Status.InProgress ||
  value === Status.Finished;

const isVoteBroadcastPayload = (
  payload: unknown
): payload is VoteBroadcastPayload => {
  if (!payload || typeof payload !== 'object') return false;
  if ((payload as { type?: unknown }).type !== 'vote') return false;

  const player = (payload as { player?: unknown }).player;
  if (!player || typeof player !== 'object') return false;
  const playerId = (player as { id?: unknown }).id;
  const status = (player as { status?: unknown }).status;
  if (typeof playerId !== 'string' || !isStatusValue(status)) return false;

  const value = (player as { value?: unknown }).value;
  if (value !== undefined && typeof value !== 'number') return false;
  const emoji = (player as { emoji?: unknown }).emoji;
  if (emoji !== undefined && typeof emoji !== 'string') return false;

  const game = (payload as { game?: unknown }).game;
  if (game !== undefined) {
    if (!game || typeof game !== 'object') return false;
    const gameStatus = (game as { gameStatus?: unknown }).gameStatus;
    if (gameStatus !== undefined && !isStatusValue(gameStatus)) return false;
  }

  return true;
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
  const [confettiSeed, setConfettiSeed] = useState<string | null>(null);

  const pendingVoteRef = useRef<PendingVote | null>(null);
  const voteDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const voteRequestIdRef = useRef(0);
  const revealRequestIdRef = useRef(0);
  const resetRequestIdRef = useRef(0);
  const timerRequestIdRef = useRef(0);
  const refreshRequestIdRef = useRef(0);
  const lastGameStatusRef = useRef<Status | null>(null);
  const gameRef = useRef<Game | null>(null);
  const playersRef = useRef<Player[] | null>(null);
  const currentPlayerIdRef = useRef<string | undefined>(undefined);

  const clearPendingVote = useCallback(() => {
    pendingVoteRef.current = null;
  }, []);

  const applyGameState = useCallback(
    (nextGame: Game, nextPlayers: Player[]) => {
      const previousStatus = lastGameStatusRef.current;
      const isTie = isTieResult(nextGame, nextPlayers);
      if (
        previousStatus !== null &&
        previousStatus !== Status.Finished &&
        nextGame.gameStatus === Status.Finished &&
        isTie
      ) {
        setConfettiSeed(`${nextGame.id}-${Date.now()}`);
      }
      if (
        previousStatus === Status.Finished &&
        nextGame.gameStatus !== Status.Finished
      ) {
        setConfettiSeed(null);
      }
      lastGameStatusRef.current = nextGame.gameStatus;
      setGame(nextGame);
      setPlayers(nextPlayers);
    },
    []
  );

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

      applyGameState(serverGame, nextPlayers);

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
  }, [gameId, router, locale, applyGameState]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    currentPlayerIdRef.current = currentPlayerId;
  }, [currentPlayerId]);

  const applyVoteBroadcast = useCallback(
    (payload: VoteBroadcastPayload) => {
      const currentGame = gameRef.current;
      const currentPlayers = playersRef.current;
      if (!currentGame || !currentPlayers) return false;

      const playerUpdate = payload.player;
      const knownPlayer = currentPlayers.find(
        (player) => player.id === playerUpdate.id
      );
      if (!knownPlayer) return false;

      const nextPlayers = currentPlayers.map((player) =>
        player.id === playerUpdate.id
          ? {
              ...player,
              status: playerUpdate.status,
              value: playerUpdate.value,
              emoji: playerUpdate.emoji,
            }
          : player
      );

      const nextGame =
        payload.game !== undefined
          ? {
              ...currentGame,
              gameStatus: payload.game.gameStatus ?? currentGame.gameStatus,
              timerProps:
                payload.game.timerProps === undefined
                  ? currentGame.timerProps
                  : (payload.game.timerProps ?? undefined),
            }
          : currentGame;

      const playerId = currentPlayerIdRef.current;
      if (playerId && playerUpdate.id === playerId) {
        const pendingVote = pendingVoteRef.current;
        if (pendingVote) {
          const synced =
            playerUpdate.status === Status.Finished &&
            playerUpdate.value === pendingVote.value &&
            (pendingVote.value !== -1 ||
              playerUpdate.emoji === pendingVote.emoji);
          if (synced) {
            pendingVoteRef.current = null;
          }
        }
      }

      applyGameState(nextGame, nextPlayers);
      return true;
    },
    [applyGameState]
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`game:${gameId}`, {
      config: { broadcast: { ack: false, self: true } },
    });

    channel.on('broadcast', { event: 'game_changed' }, ({ payload }) => {
      const payloadType = (payload as { type?: unknown } | null)?.type;
      if (process.env.NODE_ENV === 'development') {
        console.info('[realtime:client] game_changed', {
          gameId,
          type: payloadType ?? 'unknown',
        });
      }
      if (isVoteBroadcastPayload(payload)) {
        if (applyVoteBroadcast(payload)) return;
      }
      if (payloadType === 'reset') clearPendingVote();
      refresh();
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, refresh, clearPendingVote, applyVoteBroadcast]);

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

  const onReveal = useCallback(async () => {
    if (!game || !currentPlayerId) return;
    if (game.gameStatus === Status.Finished) return;
    const requestId = ++revealRequestIdRef.current;
    const previousGame = game;
    const nextTimerProps = resetTimerProps(game.timerProps) ?? undefined;
    setGame({
      ...game,
      gameStatus: Status.Finished,
      timerProps: nextTimerProps,
    });

    try {
      await reveal(game.id, currentPlayerId);
    } catch {
      if (revealRequestIdRef.current !== requestId) return;
      setGame(previousGame);
    }
  }, [game, currentPlayerId]);

  const onReset = useCallback(async () => {
    if (!game || !players || !currentPlayerId) return;
    const requestId = ++resetRequestIdRef.current;
    const previousGame = game;
    const previousPlayers = players;
    clearPendingVote();
    setConfettiSeed(null);
    const nextTimerProps = resetTimerProps(game.timerProps) ?? undefined;
    setGame({
      ...game,
      gameStatus: Status.Started,
      timerProps: nextTimerProps,
    });
    setPlayers(
      players.map((player) => ({
        ...player,
        status: Status.NotStarted,
        value: 0,
      }))
    );

    try {
      await reset(game.id, currentPlayerId);
    } catch {
      if (resetRequestIdRef.current !== requestId) return;
      setGame(previousGame);
      setPlayers(previousPlayers);
    }
  }, [game, players, currentPlayerId, clearPendingVote]);

  const onTimerUpdate = useCallback(
    async (timer: TimerProps) => {
      if (!game || !currentPlayerId) return;
      const requestId = ++timerRequestIdRef.current;
      const previousTimerProps = game.timerProps;
      setGame((prev) =>
        prev ? { ...prev, timerProps: { ...prev.timerProps, ...timer } } : prev
      );

      try {
        await updateTimer(game.id, timer, currentPlayerId);
      } catch {
        if (timerRequestIdRef.current !== requestId) return;
        setGame((prev) =>
          prev ? { ...prev, timerProps: previousTimerProps } : prev
        );
      }
    },
    [game, currentPlayerId]
  );

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
      onReveal={onReveal}
      onReset={onReset}
      onTimerUpdate={onTimerUpdate}
      voteError={voteError}
      confettiSeed={confettiSeed}
    />
  );
}
