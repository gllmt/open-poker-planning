// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import type { FunctionReturnType } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { api } from '@/convex/_generated/api';
import type { Translate } from '@/lib/i18n/types';
import { GameType } from '@/types/game';
import { Status } from '@/types/status';
import { type PreloadedGame, usePokerController } from './use-poker-controller';

type ViewerState = FunctionReturnType<typeof api.games.getViewerGameState>;
type ReadyState = Extract<ViewerState, { type: 'ready' }>;

const transport = vi.hoisted(() => {
  const mutation = () => {
    const call = vi.fn().mockResolvedValue(null);
    return Object.assign(call, { withOptimisticUpdate: vi.fn(() => call) });
  };
  return {
    state: undefined as ViewerState | undefined,
    vote: mutation(),
    reveal: mutation(),
    reset: mutation(),
    updateTimer: mutation(),
    setAutoReveal: mutation(),
    removePlayer: mutation(),
    deleteGame: mutation(),
  };
});

vi.mock('convex/react', async () => {
  const { getFunctionName } = await import('convex/server');
  return {
    usePreloadedQuery: () => transport.state,
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(reference).split(':')[1];
      return transport[name as keyof typeof transport];
    },
  };
});
vi.mock('@/lib/browser-storage', () => ({ upsertPlayerGame: vi.fn() }));
vi.mock('@/lib/api/games', () => ({
  leaveGame: vi.fn().mockResolvedValue(undefined),
}));

function fixture(): ReadyState {
  return {
    type: 'ready',
    currentPlayerId: 'alice',
    game: {
      id: 'game',
      name: 'Sprint',
      createdBy: 'Alice',
      createdById: 'alice',
      gameType: GameType.Fibonacci,
      cards: [],
      gameStatus: Status.Started,
      updatedAt: '2026-09-06T12:00:00.000Z',
    },
    players: [
      { id: 'alice', name: 'Alice', status: Status.NotStarted, value: 0 },
      { id: 'bob', name: 'Bob', status: Status.NotStarted },
    ],
  };
}

const translate: Translate = (key) => key;
function useController() {
  return usePokerController({
    gameId: 'game',
    initialSession: { playerId: 'alice', playerTokenHash: 'a'.repeat(64) },
    preloadedGame: {} as PreloadedGame,
    translate,
  });
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  transport.state = fixture();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('usePokerController', () => {
  it('renders the preloaded state on the first render', () => {
    const { result } = renderHook(useController);
    expect(result.current.game?.name).toBe('Sprint');
    expect(result.current.players).toHaveLength(2);
    expect(result.current.confettiSeed).toBeNull();
  });

  it('restores the server vote after rapid A then B is rejected, without sending A', async () => {
    const request = deferred();
    transport.vote.mockReturnValueOnce(request.promise);
    const { result } = renderHook(useController);
    act(() => result.current.onVote(3));
    act(() => vi.advanceTimersByTime(50));
    act(() => result.current.onVote(5));
    act(() => vi.advanceTimersByTime(150));
    expect(transport.vote).toHaveBeenCalledTimes(1);
    expect(transport.vote).toHaveBeenCalledWith(
      expect.objectContaining({ value: 5 })
    );
    expect(result.current.players?.[0].value).toBe(5);
    await act(async () => request.reject(new Error('rejected')));
    expect(result.current.players?.[0]).toMatchObject({
      value: 0,
      status: Status.NotStarted,
    });
    expect(result.current.voteError).toBe('game.voteFailed');
  });

  it('preserves server pushes and a confirmed A when B fails', async () => {
    const first = deferred();
    const second = deferred();
    transport.vote
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(useController);
    act(() => result.current.onVote(3));
    act(() => vi.advanceTimersByTime(150));
    act(() => result.current.onVote(5));
    act(() => vi.advanceTimersByTime(150));
    const state = fixture();
    state.game.gameStatus = Status.InProgress;
    state.players[0] = {
      ...state.players[0],
      value: 3,
      status: Status.Finished,
    };
    state.players[1] = { ...state.players[1], status: Status.Finished };
    transport.state = state;
    rerender();
    await act(async () => first.resolve());
    expect(result.current.players?.[0].value).toBe(5);
    await act(async () => second.reject(new Error('rejected')));
    expect(result.current.players?.[0].value).toBe(3);
    expect(result.current.players?.[1].status).toBe(Status.Finished);
  });

  it('ignores an older rejection while a newer vote is pending', async () => {
    const first = deferred();
    const second = deferred();
    transport.vote
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(useController);
    act(() => result.current.onVote(3));
    act(() => vi.advanceTimersByTime(150));
    act(() => result.current.onVote(5));
    act(() => vi.advanceTimersByTime(150));
    await act(async () => first.reject(new Error('old failure')));
    expect(result.current.players?.[0].value).toBe(5);
    expect(result.current.voteError).toBeNull();
    await act(async () => second.resolve());
  });

  it('cancels an unsent vote on reset', async () => {
    const { result } = renderHook(useController);
    act(() => result.current.onVote(3));
    await act(async () => result.current.onReset());
    act(() => vi.advanceTimersByTime(150));
    expect(transport.vote).not.toHaveBeenCalled();
    expect(result.current.players?.[0].value).toBe(0);
  });

  it.each(['finish', 'reset', 'revoke'] as const)(
    'cancels an unsent vote on a remote %s',
    (change) => {
      const initial = fixture();
      initial.game.gameStatus = Status.InProgress;
      transport.state = initial;
      const { result, rerender } = renderHook(useController);
      act(() => result.current.onVote(3));
      transport.state =
        change === 'revoke'
          ? { type: 'revoked', reason: 'removed' }
          : {
              ...initial,
              game: {
                ...initial.game,
                gameStatus:
                  change === 'finish' ? Status.Finished : Status.Started,
              },
            };
      rerender();
      act(() => vi.advanceTimersByTime(150));
      expect(transport.vote).not.toHaveBeenCalled();
    }
  );

  it('propagates command failures and keeps the newest query state', async () => {
    const request = deferred();
    transport.reveal.mockReturnValueOnce(request.promise);
    const { result, rerender } = renderHook(useController);
    const failure = expect(result.current.onReveal()).rejects.toThrow(
      'rejected'
    );
    const latest = fixture();
    latest.game.name = 'Renamed remotely';
    transport.state = latest;
    rerender();
    await act(async () => request.reject(new Error('rejected')));
    await failure;
    expect(result.current.game?.name).toBe('Renamed remotely');
  });

  it('waits for revealed votes before celebrating and does not repeat on an unrelated push', () => {
    const { result, rerender } = renderHook(useController);
    const revealed = fixture();
    revealed.game.gameStatus = Status.Finished;
    revealed.game.updatedAt = '2026-09-06T12:01:00.000Z';
    revealed.players = revealed.players.map((player) => ({
      ...player,
      status: Status.Finished,
      value: 3,
    }));
    transport.state = revealed;
    rerender();
    const seed = result.current.confettiSeed;
    expect(seed).toBeTruthy();
    transport.state = {
      ...revealed,
      game: { ...revealed.game, updatedAt: '2026-09-06T12:02:00.000Z' },
    };
    rerender();
    expect(result.current.confettiSeed).toBe(seed);
  });
});
