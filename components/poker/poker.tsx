'use client';

import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useI18n } from '@/components/i18n/use-i18n';
import { Loading } from '@/components/ui/loading';
import { api } from '@/convex/_generated/api';
import {
  getPlayerGamesFromCache,
  upsertPlayerGame,
} from '@/lib/browser-storage';
import { withLocale } from '@/lib/i18n/paths';
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
  const [auth, setAuth] = useState<{
    playerId: string;
    joinTokenHash: string;
    playerTokenHash: string;
    adminTokenHash?: string;
  } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const pendingVoteRef = useRef<PendingVote | null>(null);
  const voteDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const voteRequestIdRef = useRef(0);
  const revealRequestIdRef = useRef(0);
  const resetRequestIdRef = useRef(0);
  const timerRequestIdRef = useRef(0);
  const lastGameStatusRef = useRef<Status | null>(null);
  const gameRef = useRef<Game | null>(null);
  const playersRef = useRef<Player[] | null>(null);

  const voteMutation = useMutation(api.games.vote);
  const revealMutation = useMutation(api.games.reveal);
  const resetMutation = useMutation(api.games.reset);
  const updateTimerMutation = useMutation(api.games.updateTimer);
  const setAutoRevealMutation = useMutation(api.games.setAutoReveal);
  const removePlayerMutation = useMutation(api.games.removePlayer);
  const deleteGameMutation = useMutation(api.games.deleteGame);

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

  const applyServerState = useCallback(
    (serverGame: Game, serverPlayers: Player[], playerId: string) => {
      let nextPlayers = serverPlayers;
      if (pendingVoteRef.current && serverGame.gameStatus === Status.Started) {
        pendingVoteRef.current = null;
      }
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

      const cached = getPlayerGamesFromCache().find((g) => g.id === gameId);
      upsertPlayerGame({
        id: serverGame.id,
        name: serverGame.name,
        createdBy: serverGame.createdBy,
        createdById: serverGame.createdById,
        playerId,
        joinToken: cached?.joinToken,
        joinTokenHash: cached?.joinTokenHash,
        playerTokenHash: cached?.playerTokenHash,
        adminTokenHash: cached?.adminTokenHash,
        isAllowMembersToManageSession: serverGame.isAllowMembersToManageSession,
      });
    },
    [applyGameState, gameId]
  );

  useEffect(() => {
    const cached = getPlayerGamesFromCache().find((g) => g.id === gameId);

    if (!cached?.playerId || !cached.joinTokenHash || !cached.playerTokenHash) {
      router.push(withLocale(`/join/${gameId}`, locale));
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- init from localStorage
    setAuth({
      playerId: cached.playerId,
      joinTokenHash: cached.joinTokenHash,
      playerTokenHash: cached.playerTokenHash,
      adminTokenHash: cached.adminTokenHash,
    });
    setCurrentPlayerId(cached.playerId);
  }, [gameId, locale, router]);

  const queryArgs = auth
    ? { gameId, joinTokenHash: auth.joinTokenHash }
    : 'skip';

  const gameState = useQuery(api.games.getGameState, queryArgs);

  useEffect(() => {
    if (!auth || gameState) return;

    // Timeout to detect if query never resolves (e.g., network issues)
    const timeout = setTimeout(() => {
      if (loading && !gameState) {
        setQueryError('Failed to load game data. Please refresh the page.');
        setLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [auth, loading, gameState]);

  useEffect(() => {
    if (!gameState || !auth) return;
    /* eslint-disable react-hooks/set-state-in-effect -- sync from Convex subscription */
    if (queryError) setQueryError(null);
    applyServerState(gameState.game, gameState.players, auth.playerId);
    setLoading(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [gameState, auth, applyServerState, queryError]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

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
    if (!game || !currentPlayerId || !auth) return;
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
      await revealMutation({
        gameId: game.id,
        adminTokenHash: auth.adminTokenHash,
        callerPlayerId: auth.playerId,
        playerTokenHash: auth.playerTokenHash,
      });
    } catch {
      if (revealRequestIdRef.current !== requestId) return;
      gameRef.current = previousGame;
      setGame(previousGame);
    }
  }, [game, currentPlayerId, auth, revealMutation]);

  const onReset = useCallback(async () => {
    if (!game || !players || !currentPlayerId || !auth) return;
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
      await resetMutation({
        gameId: game.id,
        adminTokenHash: auth.adminTokenHash,
        callerPlayerId: auth.playerId,
        playerTokenHash: auth.playerTokenHash,
      });
    } catch {
      if (resetRequestIdRef.current !== requestId) return;
      gameRef.current = previousGame;
      playersRef.current = previousPlayers;
      setGame(previousGame);
      setPlayers(previousPlayers);
    }
  }, [game, players, currentPlayerId, auth, clearPendingVote, resetMutation]);

  const onTimerUpdate = useCallback(
    async (timer: TimerProps) => {
      if (!game || !currentPlayerId || !auth) return;
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
        await updateTimerMutation({
          gameId: game.id,
          timerProps: timer,
          adminTokenHash: auth.adminTokenHash,
          callerPlayerId: auth.playerId,
          playerTokenHash: auth.playerTokenHash,
        });
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
    [game, currentPlayerId, auth, updateTimerMutation]
  );

  const onAutoReveal = useCallback(
    async (value: boolean) => {
      if (!auth) return;
      await setAutoRevealMutation({
        gameId,
        autoReveal: value,
        adminTokenHash: auth.adminTokenHash,
        callerPlayerId: auth.playerId,
        playerTokenHash: auth.playerTokenHash,
      });
    },
    [auth, gameId, setAutoRevealMutation]
  );

  const onRemovePlayer = useCallback(
    async (playerId: string) => {
      if (!auth) return;
      await removePlayerMutation({
        gameId,
        playerId,
        adminTokenHash: auth.adminTokenHash,
        callerPlayerId: auth.playerId,
        playerTokenHash: auth.playerTokenHash,
      });
    },
    [auth, gameId, removePlayerMutation]
  );

  const onDeleteGame = useCallback(async () => {
    if (!auth) return;
    await deleteGameMutation({
      gameId,
      adminTokenHash: auth.adminTokenHash,
      callerPlayerId: auth.playerId,
      playerTokenHash: auth.playerTokenHash,
    });
  }, [auth, gameId, deleteGameMutation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loading />
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-destructive">{queryError}</p>
        <button
          type="button"
          className="mt-4 text-sm underline"
          onClick={() => window.location.reload()}
        >
          {t('common.retry') || 'Retry'}
        </button>
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
    if (!game || !currentPlayerId || !auth) return;
    if (game.gameStatus === Status.Finished) return;

    pendingVoteRef.current = { value, emoji };
    setVoteError(null);

    const previousPlayers = playersRef.current;

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

      voteMutation({
        gameId,
        playerId,
        playerTokenHash: auth.playerTokenHash,
        value: pendingVote.value,
        emoji: pendingVote.emoji,
      }).catch((e) => {
        if (voteRequestIdRef.current !== requestId) return;
        pendingVoteRef.current = null;
        setVoteError(e instanceof Error ? e.message : t('game.voteFailed'));
        if (previousPlayers) {
          playersRef.current = previousPlayers;
          setPlayers(previousPlayers);
        }
      });
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
      onAutoReveal={onAutoReveal}
      onDeleteGame={onDeleteGame}
      onRemovePlayer={onRemovePlayer}
      voteError={voteError}
      confettiSeed={confettiSeed}
    />
  );
}
