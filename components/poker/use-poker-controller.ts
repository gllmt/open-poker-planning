'use client';

import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { api } from '@/convex/_generated/api';
import { leaveGame as leaveGameRequest } from '@/lib/api/games';
import {
  getPlayerGamesFromCache,
  upsertPlayerGame,
} from '@/lib/browser-storage';
import { resetTimerProps } from '@/lib/timer/reset-timer-props';
import type { Game, TimerProps } from '@/types/game';
import type { Player } from '@/types/player';
import { Status } from '@/types/status';

import { isTieResult } from './hooks/use-confetti';

type PendingVote = {
  value: number;
  emoji?: string;
};

type SessionExitReason = 'left' | 'missing-session' | 'removed';

type PokerSession = {
  playerId: string;
  playerTokenHash: string;
  adminTokenHash?: string;
};

type PokerState = {
  game: Game | null;
  players: Player[] | null;
  loading: boolean;
  currentPlayerId: string | undefined;
  voteError: string | null;
  confettiSeed: string | null;
  auth: PokerSession;
  queryError: string | null;
  sessionExitReason: SessionExitReason | null;
};

type PokerAction =
  | { type: 'set-auth'; auth: PokerSession }
  | { type: 'set-game'; value: Game | null }
  | { type: 'set-players'; value: Player[] | null }
  | { type: 'set-vote-error'; value: string | null }
  | { type: 'set-query-error-and-stop-loading'; value: string }
  | { type: 'set-session-exit'; value: SessionExitReason | null }
  | {
      type: 'apply-snapshot';
      game: Game;
      players: Player[];
      confettiSeed: string | null;
      currentPlayerId: string;
      loading?: boolean;
      clearQueryError?: boolean;
    };

function getInitialState(initialSession: PokerSession): PokerState {
  return {
    game: null,
    players: null,
    loading: true,
    currentPlayerId: initialSession.playerId,
    voteError: null,
    confettiSeed: null,
    auth: initialSession,
    queryError: null,
    sessionExitReason: null,
  };
}

function getPlayersSignature(players: Player[]) {
  return players
    .map(
      (player) =>
        `${player.id}:${player.status}:${player.value ?? ''}:${player.emoji ?? ''}`
    )
    .join('|');
}

function getSnapshotSignature(
  game: Game,
  players: Player[],
  currentPlayerId: string,
  confettiSeed: string | null
) {
  return [
    game.id,
    game.updatedAt ?? '',
    game.gameStatus,
    currentPlayerId,
    confettiSeed ?? '',
    getPlayersSignature(players),
  ].join('::');
}

function pokerReducer(state: PokerState, action: PokerAction): PokerState {
  switch (action.type) {
    case 'set-auth':
      return {
        ...state,
        auth: action.auth,
        currentPlayerId: action.auth.playerId,
      };
    case 'set-game':
      return { ...state, game: action.value };
    case 'set-players':
      return { ...state, players: action.value };
    case 'set-vote-error':
      return { ...state, voteError: action.value };
    case 'set-query-error-and-stop-loading':
      return {
        ...state,
        queryError: action.value,
        loading: false,
      };
    case 'set-session-exit':
      return {
        ...state,
        loading: false,
        sessionExitReason: action.value,
      };
    case 'apply-snapshot':
      return {
        ...state,
        game: action.game,
        players: action.players,
        confettiSeed: action.confettiSeed,
        currentPlayerId: action.currentPlayerId,
        loading: action.loading ?? state.loading,
        queryError: action.clearQueryError ? null : state.queryError,
        sessionExitReason: null,
      };
    default:
      return state;
  }
}

type UsePokerControllerArgs = {
  gameId: string;
  initialSession: PokerSession;
  translate: (key: string) => string;
};

export function usePokerController({
  gameId,
  initialSession,
  translate,
}: UsePokerControllerArgs) {
  const [state, dispatch] = useReducer(
    pokerReducer,
    initialSession,
    getInitialState
  );

  const authRef = useRef(state.auth);
  const queryErrorRef = useRef<string | null>(state.queryError);
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
  const confettiSeedRef = useRef<string | null>(null);
  const lastAppliedSnapshotRef = useRef<string | null>(null);

  const voteMutation = useMutation(api.games.vote);
  const revealMutation = useMutation(api.games.reveal);
  const resetMutation = useMutation(api.games.reset);
  const updateTimerMutation = useMutation(api.games.updateTimer);
  const setAutoRevealMutation = useMutation(api.games.setAutoReveal);
  const removePlayerMutation = useMutation(api.games.removePlayer);
  const deleteGameMutation = useMutation(api.games.deleteGame);

  useEffect(() => {
    authRef.current = state.auth;
  }, [state.auth]);

  useEffect(() => {
    queryErrorRef.current = state.queryError;
  }, [state.queryError]);

  const clearPendingVote = useCallback(() => {
    pendingVoteRef.current = null;
  }, []);

  const applyGameState = useCallback(
    (
      nextGame: Game,
      nextPlayers: Player[],
      currentPlayerId: string,
      options?: {
        loading?: boolean;
        clearQueryError?: boolean;
      }
    ) => {
      const previousStatus = lastGameStatusRef.current;
      const isTie = isTieResult(nextGame, nextPlayers);
      let nextConfettiSeed = confettiSeedRef.current;

      if (
        previousStatus !== null &&
        previousStatus !== Status.Finished &&
        nextGame.gameStatus === Status.Finished &&
        isTie
      ) {
        nextConfettiSeed = `${nextGame.id}-${Date.now()}`;
      }

      if (
        previousStatus === Status.Finished &&
        nextGame.gameStatus !== Status.Finished
      ) {
        nextConfettiSeed = null;
      }

      lastGameStatusRef.current = nextGame.gameStatus;
      const nextSnapshotSignature = getSnapshotSignature(
        nextGame,
        nextPlayers,
        currentPlayerId,
        nextConfettiSeed
      );

      if (
        lastAppliedSnapshotRef.current === nextSnapshotSignature &&
        !queryErrorRef.current
      ) {
        return;
      }

      lastAppliedSnapshotRef.current = nextSnapshotSignature;
      gameRef.current = nextGame;
      playersRef.current = nextPlayers;
      confettiSeedRef.current = nextConfettiSeed;

      dispatch({
        type: 'apply-snapshot',
        game: nextGame,
        players: nextPlayers,
        currentPlayerId,
        confettiSeed: nextConfettiSeed,
        loading: options?.loading,
        clearQueryError: options?.clearQueryError,
      });
    },
    []
  );

  const applyServerState = useCallback(
    (serverGame: Game, serverPlayers: Player[], currentPlayerId: string) => {
      let nextPlayers = serverPlayers;

      if (pendingVoteRef.current && serverGame.gameStatus === Status.Started) {
        pendingVoteRef.current = null;
      }

      const pendingVote = pendingVoteRef.current;
      if (pendingVote) {
        const me = nextPlayers.find((player) => player.id === currentPlayerId);
        const synced =
          me?.status === Status.Finished &&
          me.value === pendingVote.value &&
          (pendingVote.value !== -1 || me.emoji === pendingVote.emoji);

        if (synced) {
          pendingVoteRef.current = null;
        } else {
          nextPlayers = nextPlayers.map((player) =>
            player.id === currentPlayerId
              ? {
                  ...player,
                  value: pendingVote.value,
                  emoji: pendingVote.emoji,
                  status: Status.Finished,
                }
              : player
          );
        }
      }

      if (authRef.current.playerId !== currentPlayerId) {
        dispatch({
          type: 'set-auth',
          auth: {
            ...authRef.current,
            playerId: currentPlayerId,
          },
        });
      }

      applyGameState(serverGame, nextPlayers, currentPlayerId, {
        loading: false,
        clearQueryError: true,
      });

      const cached = getPlayerGamesFromCache().find(
        (entry) => entry.id === gameId
      );

      upsertPlayerGame({
        id: serverGame.id,
        name: serverGame.name,
        createdBy: serverGame.createdBy,
        createdById: serverGame.createdById,
        playerId: currentPlayerId,
        joinToken: cached?.joinToken,
        joinTokenHash: cached?.joinTokenHash,
        playerTokenHash: authRef.current.playerTokenHash,
        adminTokenHash: authRef.current.adminTokenHash,
        isAllowMembersToManageSession: serverGame.isAllowMembersToManageSession,
      });
    },
    [applyGameState, gameId]
  );

  const gameState = useQuery(api.games.getViewerGameState, {
    gameId,
    playerTokenHash: state.auth.playerTokenHash,
  });
  const gameNotFoundMessage = translate('game.gameNotFound');

  useEffect(() => {
    if (gameState) return;

    const timeout = setTimeout(() => {
      dispatch({
        type: 'set-query-error-and-stop-loading',
        value: 'Failed to load game data. Please refresh the page.',
      });
    }, 10000);

    return () => clearTimeout(timeout);
  }, [gameState]);

  useEffect(() => {
    if (!gameState) return;

    if (gameState.type === 'ready') {
      applyServerState(
        gameState.game,
        gameState.players,
        gameState.currentPlayerId
      );
      return;
    }

    if (gameState.type === 'not_found') {
      dispatch({
        type: 'set-query-error-and-stop-loading',
        value: gameNotFoundMessage,
      });
      return;
    }

    dispatch({
      type: 'set-session-exit',
      value: gameState.reason,
    });
  }, [applyServerState, gameNotFoundMessage, gameState]);

  useEffect(() => {
    return () => {
      if (voteDebounceTimeoutRef.current) {
        clearTimeout(voteDebounceTimeoutRef.current);
      }
    };
  }, []);

  const onReveal = useCallback(async () => {
    if (!state.game || !state.currentPlayerId) return;
    if (state.game.gameStatus === Status.Finished) return;

    const requestId = ++revealRequestIdRef.current;
    const previousGame = state.game;
    const nextTimerProps = resetTimerProps(state.game.timerProps) ?? undefined;
    const nextGame = {
      ...state.game,
      gameStatus: Status.Finished,
      timerProps: nextTimerProps,
    };

    gameRef.current = nextGame;
    dispatch({ type: 'set-game', value: nextGame });

    try {
      await revealMutation({
        gameId: state.game.id,
        adminTokenHash: state.auth.adminTokenHash,
        callerPlayerId: state.auth.playerId,
        playerTokenHash: state.auth.playerTokenHash,
      });
    } catch {
      if (revealRequestIdRef.current !== requestId) return;
      gameRef.current = previousGame;
      dispatch({ type: 'set-game', value: previousGame });
    }
  }, [revealMutation, state.auth, state.currentPlayerId, state.game]);

  const onReset = useCallback(async () => {
    if (!state.game || !state.players || !state.currentPlayerId) {
      return;
    }

    const requestId = ++resetRequestIdRef.current;
    const previousGame = state.game;
    const previousPlayers = state.players;
    const previousConfettiSeed = state.confettiSeed;

    clearPendingVote();

    const nextTimerProps = resetTimerProps(state.game.timerProps) ?? undefined;
    const nextGame = {
      ...state.game,
      gameStatus: Status.Started,
      timerProps: nextTimerProps,
    };
    const nextPlayers = state.players.map((player) => ({
      ...player,
      status: Status.NotStarted,
      value: 0,
    }));

    gameRef.current = nextGame;
    playersRef.current = nextPlayers;
    confettiSeedRef.current = null;
    dispatch({
      type: 'apply-snapshot',
      game: nextGame,
      players: nextPlayers,
      currentPlayerId: state.currentPlayerId,
      confettiSeed: null,
    });

    try {
      await resetMutation({
        gameId: state.game.id,
        adminTokenHash: state.auth.adminTokenHash,
        callerPlayerId: state.auth.playerId,
        playerTokenHash: state.auth.playerTokenHash,
      });
    } catch {
      if (resetRequestIdRef.current !== requestId) return;
      gameRef.current = previousGame;
      playersRef.current = previousPlayers;
      confettiSeedRef.current = previousConfettiSeed;
      dispatch({
        type: 'apply-snapshot',
        game: previousGame,
        players: previousPlayers,
        currentPlayerId: state.currentPlayerId,
        confettiSeed: previousConfettiSeed,
      });
    }
  }, [
    clearPendingVote,
    resetMutation,
    state.auth,
    state.confettiSeed,
    state.currentPlayerId,
    state.game,
    state.players,
  ]);

  const onTimerUpdate = useCallback(
    async (timer: TimerProps) => {
      if (!state.game || !state.currentPlayerId) return;

      const requestId = ++timerRequestIdRef.current;
      const previousTimerProps = state.game.timerProps;
      const nextGame = {
        ...state.game,
        timerProps: { ...state.game.timerProps, ...timer },
      };

      gameRef.current = nextGame;
      dispatch({ type: 'set-game', value: nextGame });

      try {
        await updateTimerMutation({
          gameId: state.game.id,
          timerProps: timer,
          adminTokenHash: state.auth.adminTokenHash,
          callerPlayerId: state.auth.playerId,
          playerTokenHash: state.auth.playerTokenHash,
        });
      } catch (error) {
        if (timerRequestIdRef.current !== requestId) return;
        const revertedGame = { ...state.game, timerProps: previousTimerProps };
        gameRef.current = revertedGame;
        dispatch({ type: 'set-game', value: revertedGame });
        throw error instanceof Error
          ? error
          : new Error('Failed to update timer');
      }
    },
    [state.auth, state.currentPlayerId, state.game, updateTimerMutation]
  );

  const onAutoReveal = useCallback(
    async (value: boolean) => {
      await setAutoRevealMutation({
        gameId,
        autoReveal: value,
        adminTokenHash: state.auth.adminTokenHash,
        callerPlayerId: state.auth.playerId,
        playerTokenHash: state.auth.playerTokenHash,
      });
    },
    [gameId, setAutoRevealMutation, state.auth]
  );

  const onRemovePlayer = useCallback(
    async (playerId: string) => {
      await removePlayerMutation({
        gameId,
        playerId,
        adminTokenHash: state.auth.adminTokenHash,
        callerPlayerId: state.auth.playerId,
        playerTokenHash: state.auth.playerTokenHash,
      });
    },
    [gameId, removePlayerMutation, state.auth]
  );

  const onDeleteGame = useCallback(async () => {
    await deleteGameMutation({
      gameId,
      adminTokenHash: state.auth.adminTokenHash,
      callerPlayerId: state.auth.playerId,
      playerTokenHash: state.auth.playerTokenHash,
    });
  }, [deleteGameMutation, gameId, state.auth]);

  const onLeaveGame = useCallback(async () => {
    await leaveGameRequest(gameId, state.auth.playerId);
    dispatch({ type: 'set-session-exit', value: 'left' });
  }, [gameId, state.auth.playerId]);

  const onVote = useCallback(
    (value: number, emoji?: string) => {
      if (
        !state.game ||
        !state.currentPlayerId ||
        !state.players ||
        state.game.gameStatus === Status.Finished
      ) {
        return;
      }

      pendingVoteRef.current = { value, emoji };
      dispatch({ type: 'set-vote-error', value: null });

      const previousPlayers = playersRef.current;
      const nextPlayers = state.players.map((player) =>
        player.id === state.currentPlayerId
          ? { ...player, value, emoji, status: Status.Finished }
          : player
      );

      playersRef.current = nextPlayers;
      dispatch({ type: 'set-players', value: nextPlayers });

      if (voteDebounceTimeoutRef.current) {
        clearTimeout(voteDebounceTimeoutRef.current);
      }

      const requestId = ++voteRequestIdRef.current;
      const playerId = state.currentPlayerId;
      const playerTokenHash = state.auth.playerTokenHash;

      voteDebounceTimeoutRef.current = setTimeout(() => {
        const pendingVote = pendingVoteRef.current;
        if (!pendingVote || !playerId) return;

        voteMutation({
          gameId,
          playerId,
          playerTokenHash,
          value: pendingVote.value,
          emoji: pendingVote.emoji,
        }).catch((error) => {
          if (voteRequestIdRef.current !== requestId) return;
          pendingVoteRef.current = null;
          dispatch({
            type: 'set-vote-error',
            value:
              error instanceof Error
                ? error.message
                : translate('game.voteFailed'),
          });

          if (previousPlayers) {
            playersRef.current = previousPlayers;
            dispatch({ type: 'set-players', value: previousPlayers });
          }
        });
      }, 150);
    },
    [
      gameId,
      state.auth.playerTokenHash,
      state.currentPlayerId,
      state.game,
      state.players,
      translate,
      voteMutation,
    ]
  );

  return {
    game: state.game,
    players: state.players,
    loading: state.loading,
    currentPlayerId: state.currentPlayerId,
    isAdmin: Boolean(state.auth.adminTokenHash),
    voteError: state.voteError,
    confettiSeed: state.confettiSeed,
    queryError: state.queryError,
    sessionExitReason: state.sessionExitReason,
    onVote,
    onReveal,
    onReset,
    onTimerUpdate,
    onAutoReveal,
    onDeleteGame,
    onLeaveGame,
    onRemovePlayer,
  };
}
