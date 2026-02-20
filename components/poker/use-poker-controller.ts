'use client';

import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { api } from '@/convex/_generated/api';
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

type PokerAuth = {
  playerId: string;
  joinTokenHash: string;
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
  auth: PokerAuth | null;
  queryError: string | null;
  shouldRedirectToJoin: boolean;
};

type PokerAction =
  | { type: 'set-auth'; auth: PokerAuth }
  | { type: 'require-join' }
  | { type: 'set-game'; value: Game | null }
  | { type: 'set-players'; value: Player[] | null }
  | { type: 'set-vote-error'; value: string | null }
  | { type: 'set-query-error-and-stop-loading'; value: string }
  | {
      type: 'apply-snapshot';
      game: Game;
      players: Player[];
      confettiSeed: string | null;
      loading?: boolean;
      clearQueryError?: boolean;
    };

const initialState: PokerState = {
  game: null,
  players: null,
  loading: true,
  currentPlayerId: undefined,
  voteError: null,
  confettiSeed: null,
  auth: null,
  queryError: null,
  shouldRedirectToJoin: false,
};

function pokerReducer(state: PokerState, action: PokerAction): PokerState {
  switch (action.type) {
    case 'set-auth':
      return {
        ...state,
        auth: action.auth,
        currentPlayerId: action.auth.playerId,
        shouldRedirectToJoin: false,
      };
    case 'require-join':
      return {
        ...state,
        shouldRedirectToJoin: true,
        loading: false,
      };
    case 'set-game':
      return { ...state, game: action.value };
    case 'set-players':
      return { ...state, players: action.value };
    case 'set-vote-error':
      return { ...state, voteError: action.value };
    case 'set-query-error-and-stop-loading':
      return { ...state, queryError: action.value, loading: false };
    case 'apply-snapshot':
      return {
        ...state,
        game: action.game,
        players: action.players,
        confettiSeed: action.confettiSeed,
        loading: action.loading ?? state.loading,
        queryError: action.clearQueryError ? null : state.queryError,
      };
    default:
      return state;
  }
}

type UsePokerControllerArgs = {
  gameId: string;
  translate: (key: string) => string;
};

export function usePokerController({
  gameId,
  translate,
}: UsePokerControllerArgs) {
  const [state, dispatch] = useReducer(pokerReducer, initialState);

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
    (
      nextGame: Game,
      nextPlayers: Player[],
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
      gameRef.current = nextGame;
      playersRef.current = nextPlayers;
      confettiSeedRef.current = nextConfettiSeed;

      dispatch({
        type: 'apply-snapshot',
        game: nextGame,
        players: nextPlayers,
        confettiSeed: nextConfettiSeed,
        loading: options?.loading,
        clearQueryError: options?.clearQueryError,
      });
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
        const me = nextPlayers.find((player) => player.id === playerId);
        const synced =
          me?.status === Status.Finished &&
          me.value === pendingVote.value &&
          (pendingVote.value !== -1 || me.emoji === pendingVote.emoji);

        if (synced) {
          pendingVoteRef.current = null;
        } else {
          nextPlayers = nextPlayers.map((player) =>
            player.id === playerId
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

      applyGameState(serverGame, nextPlayers, {
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
    const cached = getPlayerGamesFromCache().find(
      (entry) => entry.id === gameId
    );
    if (!cached?.playerId || !cached.joinTokenHash || !cached.playerTokenHash) {
      dispatch({ type: 'require-join' });
      return;
    }

    dispatch({
      type: 'set-auth',
      auth: {
        playerId: cached.playerId,
        joinTokenHash: cached.joinTokenHash,
        playerTokenHash: cached.playerTokenHash,
        adminTokenHash: cached.adminTokenHash,
      },
    });
  }, [gameId]);

  const queryArgs = state.auth
    ? { gameId, joinTokenHash: state.auth.joinTokenHash }
    : 'skip';

  const gameState = useQuery(api.games.getGameState, queryArgs);

  useEffect(() => {
    if (!state.auth || gameState) return;

    const timeout = setTimeout(() => {
      dispatch({
        type: 'set-query-error-and-stop-loading',
        value: 'Failed to load game data. Please refresh the page.',
      });
    }, 10000);

    return () => clearTimeout(timeout);
  }, [state.auth, gameState]);

  useEffect(() => {
    if (!gameState || !state.auth) return;
    applyServerState(gameState.game, gameState.players, state.auth.playerId);
  }, [gameState, state.auth, applyServerState]);

  useEffect(() => {
    if (!state.players || !state.currentPlayerId) return;
    const stillInGame = state.players.some(
      (player) => player.id === state.currentPlayerId
    );
    if (!stillInGame) dispatch({ type: 'require-join' });
  }, [state.players, state.currentPlayerId]);

  useEffect(() => {
    return () => {
      if (voteDebounceTimeoutRef.current) {
        clearTimeout(voteDebounceTimeoutRef.current);
      }
    };
  }, []);

  const onReveal = useCallback(async () => {
    if (!state.game || !state.currentPlayerId || !state.auth) return;
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
  }, [state.game, state.currentPlayerId, state.auth, revealMutation]);

  const onReset = useCallback(async () => {
    if (
      !state.game ||
      !state.players ||
      !state.currentPlayerId ||
      !state.auth
    ) {
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
        confettiSeed: previousConfettiSeed,
      });
    }
  }, [
    state.game,
    state.players,
    state.currentPlayerId,
    state.auth,
    state.confettiSeed,
    clearPendingVote,
    resetMutation,
  ]);

  const onTimerUpdate = useCallback(
    async (timer: TimerProps) => {
      if (!state.game || !state.currentPlayerId || !state.auth) return;
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
    [state.game, state.currentPlayerId, state.auth, updateTimerMutation]
  );

  const onAutoReveal = useCallback(
    async (value: boolean) => {
      if (!state.auth) return;
      await setAutoRevealMutation({
        gameId,
        autoReveal: value,
        adminTokenHash: state.auth.adminTokenHash,
        callerPlayerId: state.auth.playerId,
        playerTokenHash: state.auth.playerTokenHash,
      });
    },
    [state.auth, gameId, setAutoRevealMutation]
  );

  const onRemovePlayer = useCallback(
    async (playerId: string) => {
      if (!state.auth) return;
      await removePlayerMutation({
        gameId,
        playerId,
        adminTokenHash: state.auth.adminTokenHash,
        callerPlayerId: state.auth.playerId,
        playerTokenHash: state.auth.playerTokenHash,
      });
    },
    [state.auth, gameId, removePlayerMutation]
  );

  const onDeleteGame = useCallback(async () => {
    if (!state.auth) return;
    await deleteGameMutation({
      gameId,
      adminTokenHash: state.auth.adminTokenHash,
      callerPlayerId: state.auth.playerId,
      playerTokenHash: state.auth.playerTokenHash,
    });
  }, [state.auth, gameId, deleteGameMutation]);

  const onVote = useCallback(
    (value: number, emoji?: string) => {
      if (
        !state.game ||
        !state.currentPlayerId ||
        !state.auth ||
        !state.players
      ) {
        return;
      }
      if (state.game.gameStatus === Status.Finished) return;

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
      state.game,
      state.currentPlayerId,
      state.auth,
      state.players,
      gameId,
      voteMutation,
      translate,
    ]
  );

  return {
    game: state.game,
    players: state.players,
    loading: state.loading,
    currentPlayerId: state.currentPlayerId,
    voteError: state.voteError,
    confettiSeed: state.confettiSeed,
    queryError: state.queryError,
    shouldRedirectToJoin: state.shouldRedirectToJoin,
    onVote,
    onReveal,
    onReset,
    onTimerUpdate,
    onAutoReveal,
    onDeleteGame,
    onRemovePlayer,
  };
}
