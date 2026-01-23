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
  isAutoRevealBroadcastPayload,
  isGameStatusBroadcastPayload,
  isPlayerJoinedBroadcastPayload,
  isPlayerRemovedBroadcastPayload,
  isStoryUpdatedBroadcastPayload,
  isTimerBroadcastPayload,
  isVoteBroadcastPayload,
} from '@/lib/broadcast/guards';
import {
  getCurrentPlayerId,
  getPlayerGamesFromCache,
  upsertPlayerGame,
} from '@/lib/browser-storage';
import { withLocale } from '@/lib/i18n/paths';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { resetTimerProps } from '@/lib/timer/reset-timer-props';
import type {
  AutoRevealBroadcastPayload,
  GameStatusBroadcastPayload,
  PlayerJoinedBroadcastPayload,
  PlayerRemovedBroadcastPayload,
  StoryUpdatedBroadcastPayload,
  TimerBroadcastPayload,
  VoteBroadcastPayload,
} from '@/types/broadcast';
import type { Game, TimerProps } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { GameArea } from './game-area';
import { isTieResult } from './hooks/use-confetti';

type PendingVote = {
  value: number;
  emoji?: string;
};

const buildGameStatusUpdate = (payload: GameStatusBroadcastPayload) => {
  const update: { gameStatus?: Status; timerProps?: TimerProps | null } = {};
  if (payload.game?.gameStatus !== undefined) {
    update.gameStatus = payload.game.gameStatus;
  }
  if (payload.game?.timerProps !== undefined) {
    update.timerProps = payload.game.timerProps ?? null;
  }
  return update;
};

const hasGameStatusUpdate = (payload: GameStatusBroadcastPayload) =>
  payload.game?.gameStatus !== undefined ||
  payload.game?.timerProps !== undefined;

const resetPlayersForRound = (players: Player[]) =>
  players.map((player) => ({
    ...player,
    status: Status.NotStarted,
    value: 0,
  }));

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
      gameRef.current = nextGame;
      playersRef.current = nextPlayers;
      setGame(nextGame);
      setPlayers(nextPlayers);
    },
    []
  );

  const applyGameUpdate = useCallback(
    (update: {
      game?: {
        gameStatus?: Status;
        timerProps?: TimerProps | null;
        autoReveal?: boolean;
        storyName?: string | null;
      };
      players?: (current: Player[]) => Player[];
      clearPendingVote?: boolean;
    }) => {
      const currentGame = gameRef.current;
      const currentPlayers = playersRef.current;
      if (!currentGame || !currentPlayers) return false;

      const nextPlayers = update.players
        ? update.players(currentPlayers)
        : currentPlayers;

      const nextGame = update.game
        ? (() => {
            const { timerProps, storyName, ...gameRest } = update.game;
            return {
              ...currentGame,
              ...gameRest,
              ...(timerProps !== undefined
                ? { timerProps: timerProps ?? undefined }
                : {}),
              ...(storyName !== undefined
                ? { storyName: storyName ?? undefined }
                : {}),
            };
          })()
        : currentGame;

      if (update.clearPendingVote) clearPendingVote();
      applyGameState(nextGame, nextPlayers);
      return true;
    },
    [applyGameState, clearPendingVote]
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

  const applyPlayerJoinedBroadcast = useCallback(
    (payload: PlayerJoinedBroadcastPayload) =>
      applyGameUpdate({
        players: (currentPlayers) => {
          if (
            currentPlayers.some((player) => player.id === payload.player.id)
          ) {
            return currentPlayers;
          }
          return [
            ...currentPlayers,
            {
              id: payload.player.id,
              name: payload.player.name,
              status: payload.player.status,
              value: payload.player.value ?? 0,
              emoji: payload.player.emoji ?? undefined,
            },
          ];
        },
      }),
    [applyGameUpdate]
  );

  const applyPlayerRemovedBroadcast = useCallback(
    (payload: PlayerRemovedBroadcastPayload) =>
      applyGameUpdate({
        players: (currentPlayers) => {
          const nextPlayers = currentPlayers.filter(
            (player) => player.id !== payload.player.id
          );
          return nextPlayers.length === currentPlayers.length
            ? currentPlayers
            : nextPlayers;
        },
      }),
    [applyGameUpdate]
  );

  const applyStoryUpdatedBroadcast = useCallback(
    (payload: StoryUpdatedBroadcastPayload) => {
      const storyName = payload.game?.storyName;
      if (storyName === undefined) return false;
      return applyGameUpdate({
        game: { storyName },
      });
    },
    [applyGameUpdate]
  );

  const applyTimerBroadcast = useCallback(
    (payload: TimerBroadcastPayload) => {
      const timerProps = payload.game?.timerProps;
      if (timerProps === undefined) return false;
      return applyGameUpdate({
        game: { timerProps: timerProps ?? null },
      });
    },
    [applyGameUpdate]
  );

  const applyAutoRevealBroadcast = useCallback(
    (payload: AutoRevealBroadcastPayload) => {
      const autoReveal = payload.game?.autoReveal;
      if (autoReveal === undefined) return false;
      return applyGameUpdate({
        game: { autoReveal },
      });
    },
    [applyGameUpdate]
  );

  const applyGameStatusBroadcast = useCallback(
    (payload: GameStatusBroadcastPayload) => {
      const shouldResetPlayers =
        payload.type === 'reset' && payload.players?.reset;
      if (!shouldResetPlayers && !hasGameStatusUpdate(payload)) return false;
      return applyGameUpdate({
        game: buildGameStatusUpdate(payload),
        players: shouldResetPlayers ? resetPlayersForRound : undefined,
        clearPendingVote: payload.type === 'reset',
      });
    },
    [applyGameUpdate]
  );

  const handleBroadcastPayload = useCallback(
    (payload: unknown) => {
      if (isVoteBroadcastPayload(payload)) return applyVoteBroadcast(payload);
      if (isPlayerJoinedBroadcastPayload(payload))
        return applyPlayerJoinedBroadcast(payload);
      if (isPlayerRemovedBroadcastPayload(payload))
        return applyPlayerRemovedBroadcast(payload);
      if (isStoryUpdatedBroadcastPayload(payload))
        return applyStoryUpdatedBroadcast(payload);
      if (isTimerBroadcastPayload(payload)) return applyTimerBroadcast(payload);
      if (isAutoRevealBroadcastPayload(payload))
        return applyAutoRevealBroadcast(payload);
      if (isGameStatusBroadcastPayload(payload))
        return applyGameStatusBroadcast(payload);
      return false;
    },
    [
      applyVoteBroadcast,
      applyPlayerJoinedBroadcast,
      applyPlayerRemovedBroadcast,
      applyStoryUpdatedBroadcast,
      applyTimerBroadcast,
      applyAutoRevealBroadcast,
      applyGameStatusBroadcast,
    ]
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
      if (handleBroadcastPayload(payload)) return;
      if (payloadType === 'reset') clearPendingVote();
      refresh();
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, refresh, clearPendingVote, handleBroadcastPayload]);

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
    const nextGame = {
      ...game,
      gameStatus: Status.Finished,
      timerProps: nextTimerProps,
    };
    gameRef.current = nextGame;
    setGame(nextGame);

    try {
      await reveal(game.id, currentPlayerId);
    } catch {
      if (revealRequestIdRef.current !== requestId) return;
      gameRef.current = previousGame;
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
    const nextGame = {
      ...game,
      gameStatus: Status.Started,
      timerProps: nextTimerProps,
    };
    const nextPlayers = players.map((player) => ({
      ...player,
      status: Status.NotStarted,
      value: 0,
    }));
    gameRef.current = nextGame;
    playersRef.current = nextPlayers;
    setGame(nextGame);
    setPlayers(nextPlayers);

    try {
      await reset(game.id, currentPlayerId);
    } catch {
      if (resetRequestIdRef.current !== requestId) return;
      gameRef.current = previousGame;
      playersRef.current = previousPlayers;
      setGame(previousGame);
      setPlayers(previousPlayers);
    }
  }, [game, players, currentPlayerId, clearPendingVote]);

  const onTimerUpdate = useCallback(
    async (timer: TimerProps) => {
      if (!game || !currentPlayerId) return;
      const requestId = ++timerRequestIdRef.current;
      const previousTimerProps = game.timerProps;
      setGame((prev) => {
        if (!prev) return prev;
        const nextGame = {
          ...prev,
          timerProps: { ...prev.timerProps, ...timer },
        };
        gameRef.current = nextGame;
        return nextGame;
      });

      try {
        await updateTimer(game.id, timer, currentPlayerId);
      } catch (error) {
        if (timerRequestIdRef.current !== requestId) return;
        setGame((prev) => {
          if (!prev) return prev;
          const nextGame = { ...prev, timerProps: previousTimerProps };
          gameRef.current = nextGame;
          return nextGame;
        });
        throw error instanceof Error
          ? error
          : new Error('Failed to update timer');
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
      const nextPlayers = prev.map((p) =>
        p.id === currentPlayerId
          ? { ...p, value, emoji, status: Status.Finished }
          : p
      );
      playersRef.current = nextPlayers;
      return nextPlayers;
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
