'use client';

import type { OptimisticLocalStore } from 'convex/browser';
import { type Preloaded, useMutation, usePreloadedQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isTieResult } from './hooks/use-confetti';
import { api } from '@/convex/_generated/api';
import { leaveGame as leaveGameRequest } from '@/lib/api/games';
import { upsertPlayerGame } from '@/lib/browser-storage';
import type { Translate } from '@/lib/i18n/types';
import { resetTimerProps } from '@/lib/timer/reset-timer-props';
import type { TimerProps } from '@/types/game';
import { Status } from '@/types/status';

export type PreloadedGame = Preloaded<typeof api.games.getViewerGameState>;
type ReadyState = Extract<
  FunctionReturnType<typeof api.games.getViewerGameState>,
  { type: 'ready' }
>;

type PokerSession = {
  playerId: string;
  playerTokenHash: string;
  adminTokenHash?: string;
};

function updateViewer(
  store: OptimisticLocalStore,
  { gameId, playerTokenHash }: { gameId: string; playerTokenHash?: string },
  update: (state: ReadyState) => ReadyState
) {
  if (!playerTokenHash) return;
  const args = { gameId, playerTokenHash };
  const state = store.getQuery(api.games.getViewerGameState, args);
  if (state?.type === 'ready') {
    store.setQuery(api.games.getViewerGameState, args, update(state));
  }
}

export function usePokerController({
  gameId,
  initialSession,
  preloadedGame,
  translate,
}: {
  gameId: string;
  initialSession: PokerSession;
  preloadedGame: PreloadedGame;
  translate: Translate;
}) {
  const state = usePreloadedQuery(preloadedGame);
  const game = state.type === 'ready' ? state.game : null;
  const serverPlayers = state.type === 'ready' ? state.players : null;
  const currentPlayerId =
    state.type === 'ready' ? state.currentPlayerId : initialSession.playerId;
  const [pendingVote, setPendingVote] = useState<{
    value: number;
    emoji?: string;
  } | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [hasLeft, setHasLeft] = useState(false);
  const voteSequence = useRef(0);
  const voteTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const voteMutation = useMutation(api.games.vote);
  const revealMutation = useMutation(api.games.reveal).withOptimisticUpdate(
    (store, args) =>
      updateViewer(store, args, (current) => ({
        ...current,
        game: {
          ...current.game,
          gameStatus: Status.Finished,
          timerProps: resetTimerProps(current.game.timerProps) ?? undefined,
        },
      }))
  );
  const resetMutation = useMutation(api.games.reset).withOptimisticUpdate(
    (store, args) =>
      updateViewer(store, args, (current) => ({
        ...current,
        game: {
          ...current.game,
          gameStatus: Status.Started,
          timerProps: resetTimerProps(current.game.timerProps) ?? undefined,
        },
        players: current.players.map((player) => ({
          ...player,
          status: Status.NotStarted,
          value: 0,
          emoji: undefined,
        })),
      }))
  );
  const updateTimerMutation = useMutation(
    api.games.updateTimer
  ).withOptimisticUpdate((store, args) =>
    updateViewer(store, args, (current) => ({
      ...current,
      game: { ...current.game, timerProps: args.timerProps ?? undefined },
    }))
  );
  const setAutoRevealMutation = useMutation(
    api.games.setAutoReveal
  ).withOptimisticUpdate((store, args) =>
    updateViewer(store, args, (current) => ({
      ...current,
      game: { ...current.game, autoReveal: args.autoReveal },
    }))
  );
  const removePlayerMutation = useMutation(api.games.removePlayer);
  const deleteGameMutation = useMutation(api.games.deleteGame);

  const clearPendingVote = useCallback(() => {
    ++voteSequence.current;
    clearTimeout(voteTimeout.current);
    setPendingVote(null);
  }, []);

  const gameStatus = game?.gameStatus;
  const previousStatus = useRef(gameStatus);
  useEffect(() => {
    if (
      !gameStatus ||
      gameStatus === Status.Finished ||
      (gameStatus === Status.Started &&
        previousStatus.current !== Status.Started)
    ) {
      clearPendingVote();
    }
    previousStatus.current = gameStatus;
  }, [clearPendingVote, gameStatus]);

  useEffect(
    () => () => {
      ++voteSequence.current;
      clearTimeout(voteTimeout.current);
    },
    []
  );

  const onVote = useCallback(
    (value: number, emoji?: string) => {
      if (!gameStatus || gameStatus === Status.Finished) return;
      const sequence = ++voteSequence.current;
      clearTimeout(voteTimeout.current);
      setPendingVote({ value, emoji });
      setVoteError(null);
      voteTimeout.current = setTimeout(() => {
        void voteMutation({
          gameId,
          playerId: currentPlayerId,
          playerTokenHash: initialSession.playerTokenHash,
          value,
          emoji,
        })
          .catch(() => {
            if (sequence === voteSequence.current) {
              setVoteError(translate('game.voteFailed'));
            }
          })
          .finally(() => {
            if (sequence === voteSequence.current) setPendingVote(null);
          });
      }, 150);
    },
    [
      gameId,
      gameStatus,
      currentPlayerId,
      initialSession.playerTokenHash,
      translate,
      voteMutation,
    ]
  );

  // Only the unsent/in-flight local vote overlays the current subscription.
  // A rejection exposes the latest server state, including other players' updates.
  const players =
    pendingVote && gameStatus !== Status.Finished
      ? (serverPlayers?.map((player) =>
          player.id === currentPlayerId
            ? { ...player, ...pendingVote, status: Status.Finished }
            : player
        ) ?? null)
      : serverPlayers;

  const isTie =
    game && serverPlayers ? isTieResult(game, serverPlayers) : false;
  const previousTie = useRef(isTie);
  const lastCelebratedAt = useRef(
    gameStatus === Status.Finished ? game?.updatedAt : undefined
  );
  const [confettiSeed, setConfettiSeed] = useState<string | null>(null);
  const updatedAt = game?.updatedAt;
  useEffect(() => {
    if (
      isTie &&
      !previousTie.current &&
      updatedAt !== lastCelebratedAt.current
    ) {
      lastCelebratedAt.current = updatedAt;
      setConfettiSeed(`${gameId}-${updatedAt}`);
    }
    // oxlint-disable-next-line react/set-state-in-effect -- Clear the animation when the Convex subscription starts another round.
    if (gameStatus !== Status.Finished) setConfettiSeed(null);
    previousTie.current = isTie;
  }, [gameId, gameStatus, isTie, updatedAt]);

  const { id, name, createdBy, createdById, isAllowMembersToManageSession } =
    game ?? {};
  useEffect(() => {
    if (
      !id ||
      name === undefined ||
      createdBy === undefined ||
      createdById === undefined
    )
      return;
    upsertPlayerGame({
      id,
      name,
      createdBy,
      createdById,
      playerId: currentPlayerId,
      isAllowMembersToManageSession,
    });
  }, [
    id,
    name,
    createdBy,
    createdById,
    currentPlayerId,
    isAllowMembersToManageSession,
  ]);

  const credentials = {
    gameId,
    callerPlayerId: currentPlayerId,
    playerTokenHash: initialSession.playerTokenHash,
    adminTokenHash: initialSession.adminTokenHash,
  };

  return {
    game,
    players,
    currentPlayerId,
    isAdmin: Boolean(initialSession.adminTokenHash),
    voteError,
    confettiSeed,
    queryError:
      state.type === 'not_found' ? translate('game.gameNotFound') : null,
    sessionExitReason: hasLeft
      ? ('left' as const)
      : state.type === 'revoked'
        ? state.reason
        : null,
    onVote,
    onReveal: async () => {
      await revealMutation(credentials);
    },
    onReset: async () => {
      clearPendingVote();
      setVoteError(null);
      await resetMutation(credentials);
    },
    onTimerUpdate: async (timerProps: TimerProps) => {
      await updateTimerMutation({ ...credentials, timerProps });
    },
    onAutoReveal: async (autoReveal: boolean) => {
      await setAutoRevealMutation({ ...credentials, autoReveal });
    },
    onRemovePlayer: async (playerId: string) => {
      await removePlayerMutation({ ...credentials, playerId });
    },
    onDeleteGame: async () => {
      await deleteGameMutation(credentials);
    },
    onLeaveGame: async () => {
      await leaveGameRequest(gameId, currentPlayerId);
      clearPendingVote();
      setHasLeft(true);
    },
  };
}
