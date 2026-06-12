// @vitest-environment edge-runtime

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';

import { GameType } from '../types/game';
import { Status } from '../types/status';
import { api } from './_generated/api';
import schema from './schema';

type GlobImportMeta = ImportMeta & {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
};

const modules = (import.meta as GlobImportMeta).glob('./**/!(*.*.*)*.*s');

const GAME_ID = 'game-1';
const ALICE_ID = 'player-alice';
const BOB_ID = 'player-bob';
const CAROL_ID = 'player-carol';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);
const HASH_E = 'e'.repeat(64);
const HASH_F = '1'.repeat(64);
const HASH_X = 'f'.repeat(64);

const CARDS = [
  { value: 1, displayValue: '1', color: '#fff' },
  { value: 2, displayValue: '2', color: '#fff' },
];

function createBackend() {
  return convexTest(schema, modules);
}

type TestBackend = ReturnType<typeof createBackend>;

async function setupGame(opts?: { allowMembersToManage?: boolean }) {
  const t = createBackend();
  await t.mutation(api.games.createGame, {
    gameId: GAME_ID,
    name: 'Test game',
    createdBy: 'Alice',
    createdById: ALICE_ID,
    gameType: GameType.Fibonacci,
    cards: CARDS,
    isAllowMembersToManageSession: opts?.allowMembersToManage ?? false,
    joinTokenHash: HASH_A,
    adminTokenHash: HASH_B,
    playerTokenHash: HASH_C,
  });
  return t;
}

async function joinPlayer(
  t: TestBackend,
  opts?: {
    playerId?: string;
    playerName?: string;
    playerTokenHash?: string;
    joinTokenHash?: string;
  }
) {
  await t.mutation(api.games.joinGame, {
    gameId: GAME_ID,
    playerId: opts?.playerId ?? BOB_ID,
    playerName: opts?.playerName ?? 'Bob',
    playerTokenHash: opts?.playerTokenHash ?? HASH_D,
    joinTokenHash: opts?.joinTokenHash ?? HASH_A,
  });
}

async function getViewer(t: TestBackend, playerTokenHash = HASH_C) {
  return t.query(api.games.getViewerGameState, {
    gameId: GAME_ID,
    playerTokenHash,
  });
}

type ViewerState = Awaited<ReturnType<typeof getViewer>>;
type ReadyState = Extract<ViewerState, { type: 'ready' }>;

function expectReady(state: ViewerState): ReadyState {
  expect(state.type).toBe('ready');
  if (state.type !== 'ready') throw new Error('Expected ready viewer state');
  return state;
}

function getPlayer(state: ReadyState, playerId: string) {
  const player = state.players.find((entry) => entry.id === playerId);
  expect(player).toBeDefined();
  if (!player) throw new Error(`Expected player ${playerId}`);
  return player;
}

async function expectConvexError(promise: Promise<unknown>, code: string) {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeDefined();

  const data =
    typeof caught === 'object' && caught !== null && 'data' in caught
      ? (caught as { data?: unknown }).data
      : undefined;
  const message = caught instanceof Error ? caught.message : String(caught);
  expect(data === code || message.includes(code)).toBe(true);
}

function hashFor(index: number) {
  return index.toString(16).padStart(64, '0');
}

async function deleteAllInvites(t: TestBackend) {
  await t.run(async (ctx) => {
    const invites = await ctx.db
      .query('gameInvites')
      .withIndex('by_gameId', (q) => q.eq('gameId', GAME_ID))
      .collect();
    await Promise.all(invites.map((invite) => ctx.db.delete(invite._id)));
  });
}

describe('getViewerGameState', () => {
  it('returns ready state for the current player', async () => {
    const t = await setupGame();

    const state = expectReady(await getViewer(t));

    expect(state.currentPlayerId).toBe(ALICE_ID);
    expect(state.game.id).toBe(GAME_ID);
    expect(state.players).toHaveLength(1);
    expect(state.players[0]).toMatchObject({
      id: ALICE_ID,
      name: 'Alice',
      status: Status.NotStarted,
      value: 0,
    });
  });

  it('returns revoked for an unknown player token', async () => {
    const t = await setupGame();

    await expect(getViewer(t, HASH_X)).resolves.toEqual({
      type: 'revoked',
      reason: 'missing-session',
    });
  });

  it('returns not_found for an unknown game', async () => {
    const t = createBackend();

    await expect(
      t.query(api.games.getViewerGameState, {
        gameId: 'missing-game',
        playerTokenHash: HASH_C,
      })
    ).resolves.toEqual({ type: 'not_found' });
  });
});

describe('manage-gated mutations', () => {
  it('allows the admin token to reveal', async () => {
    const t = await setupGame();

    await t.mutation(api.games.reveal, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
    });

    const state = expectReady(await getViewer(t));
    expect(state.game.gameStatus).toBe(Status.Finished);
  });

  it('rejects reveal with a wrong admin token', async () => {
    const t = await setupGame();

    await expectConvexError(
      t.mutation(api.games.reveal, {
        gameId: GAME_ID,
        adminTokenHash: HASH_X,
      }),
      'UNAUTHORIZED'
    );
  });

  it('rejects a managing member when member controls are disabled', async () => {
    const t = await setupGame({ allowMembersToManage: false });
    await joinPlayer(t);

    await expectConvexError(
      t.mutation(api.games.reveal, {
        gameId: GAME_ID,
        callerPlayerId: BOB_ID,
        playerTokenHash: HASH_D,
      }),
      'UNAUTHORIZED'
    );
  });

  it('allows an active member when member controls are enabled', async () => {
    const t = await setupGame({ allowMembersToManage: true });
    await joinPlayer(t);

    await t.mutation(api.games.reveal, {
      gameId: GAME_ID,
      callerPlayerId: BOB_ID,
      playerTokenHash: HASH_D,
    });

    const state = expectReady(await getViewer(t));
    expect(state.game.gameStatus).toBe(Status.Finished);
  });

  it('rejects a member with the wrong player token', async () => {
    const t = await setupGame({ allowMembersToManage: true });
    await joinPlayer(t);

    await expectConvexError(
      t.mutation(api.games.reveal, {
        gameId: GAME_ID,
        callerPlayerId: BOB_ID,
        playerTokenHash: HASH_X,
      }),
      'UNAUTHORIZED'
    );
  });

  it('rejects a removed member even when member controls are enabled', async () => {
    const t = await setupGame({ allowMembersToManage: true });
    await joinPlayer(t);
    await t.mutation(api.games.removePlayer, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      adminTokenHash: HASH_B,
    });

    await expectConvexError(
      t.mutation(api.games.reveal, {
        gameId: GAME_ID,
        callerPlayerId: BOB_ID,
        playerTokenHash: HASH_D,
      }),
      'UNAUTHORIZED'
    );
  });

  it('uses the same member gate for reset', async () => {
    const t = await setupGame({ allowMembersToManage: true });
    await joinPlayer(t);
    await t.mutation(api.games.reveal, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
    });

    await t.mutation(api.games.reset, {
      gameId: GAME_ID,
      callerPlayerId: BOB_ID,
      playerTokenHash: HASH_D,
    });

    const state = expectReady(await getViewer(t));
    expect(state.game.gameStatus).toBe(Status.Started);
  });

  it('uses the same member gate for setAutoReveal', async () => {
    const t = await setupGame({ allowMembersToManage: true });
    await joinPlayer(t);

    await t.mutation(api.games.setAutoReveal, {
      gameId: GAME_ID,
      autoReveal: true,
      callerPlayerId: BOB_ID,
      playerTokenHash: HASH_D,
    });

    const state = expectReady(await getViewer(t));
    expect(state.game.autoReveal).toBe(true);
  });
});

describe('removePlayer and deleteGame authorization', () => {
  it('does not let a managing member remove the creator', async () => {
    const t = await setupGame({ allowMembersToManage: true });
    await joinPlayer(t);

    await expectConvexError(
      t.mutation(api.games.removePlayer, {
        gameId: GAME_ID,
        playerId: ALICE_ID,
        callerPlayerId: BOB_ID,
        playerTokenHash: HASH_D,
      }),
      'UNAUTHORIZED'
    );
  });

  it('lets the admin remove the creator', async () => {
    const t = await setupGame({ allowMembersToManage: true });
    await joinPlayer(t);

    await t.mutation(api.games.removePlayer, {
      gameId: GAME_ID,
      playerId: ALICE_ID,
      adminTokenHash: HASH_B,
    });

    await expect(getViewer(t)).resolves.toEqual({
      type: 'revoked',
      reason: 'removed',
    });
  });

  it('revokes active invites when a player is removed', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.mutation(api.games.removePlayer, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      adminTokenHash: HASH_B,
    });

    await expectConvexError(
      t.mutation(api.games.joinGame, {
        gameId: GAME_ID,
        playerId: CAROL_ID,
        playerName: 'Carol',
        playerTokenHash: HASH_F,
        joinTokenHash: HASH_A,
      }),
      'INVALID_INVITE'
    );
  });

  it('keeps deleteGame admin-only', async () => {
    const t = await setupGame({ allowMembersToManage: true });
    await joinPlayer(t);

    await expectConvexError(
      t.mutation(api.games.deleteGame, {
        gameId: GAME_ID,
        callerPlayerId: BOB_ID,
        playerTokenHash: HASH_D,
      }),
      'UNAUTHORIZED'
    );

    await t.mutation(api.games.deleteGame, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
    });

    await expect(getViewer(t)).resolves.toEqual({ type: 'not_found' });
  });
});

describe('createInvite and joinGame authorization', () => {
  it('allows joining with the initial active invite', async () => {
    const t = await setupGame();

    await joinPlayer(t);

    const state = expectReady(await getViewer(t, HASH_D));
    expect(state.currentPlayerId).toBe(BOB_ID);
  });

  it('rejects an unknown invite token while invite rows exist', async () => {
    const t = await setupGame();

    await expectConvexError(
      t.mutation(api.games.joinGame, {
        gameId: GAME_ID,
        playerId: BOB_ID,
        playerName: 'Bob',
        playerTokenHash: HASH_D,
        joinTokenHash: HASH_X,
      }),
      'INVALID_INVITE'
    );
  });

  it('rejects revoked invite tokens', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.mutation(api.games.removePlayer, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      adminTokenHash: HASH_B,
    });

    await expectConvexError(
      t.mutation(api.games.joinGame, {
        gameId: GAME_ID,
        playerId: CAROL_ID,
        playerName: 'Carol',
        playerTokenHash: HASH_F,
        joinTokenHash: HASH_A,
      }),
      'INVALID_INVITE'
    );
  });

  it('falls back to the legacy game join token only when no invite rows exist', async () => {
    const t = await setupGame();
    await deleteAllInvites(t);

    await joinPlayer(t);

    await expectConvexError(
      t.mutation(api.games.joinGame, {
        gameId: GAME_ID,
        playerId: CAROL_ID,
        playerName: 'Carol',
        playerTokenHash: HASH_F,
        joinTokenHash: HASH_X,
      }),
      'INVALID_INVITE'
    );
  });

  it('allows a newly created admin invite to be used', async () => {
    const t = await setupGame();

    await t.mutation(api.games.createInvite, {
      gameId: GAME_ID,
      tokenHash: HASH_E,
      createdByPlayerId: ALICE_ID,
      playerTokenHash: HASH_C,
      adminTokenHash: HASH_B,
    });
    await joinPlayer(t, {
      playerId: BOB_ID,
      playerName: 'Bob',
      playerTokenHash: HASH_D,
      joinTokenHash: HASH_E,
    });

    const state = expectReady(await getViewer(t, HASH_D));
    expect(state.currentPlayerId).toBe(BOB_ID);
  });

  it('allows an active player to create an invite without member controls', async () => {
    const t = await setupGame({ allowMembersToManage: false });
    await joinPlayer(t);

    await t.mutation(api.games.createInvite, {
      gameId: GAME_ID,
      tokenHash: HASH_E,
      createdByPlayerId: BOB_ID,
      playerTokenHash: HASH_D,
    });
    await joinPlayer(t, {
      playerId: CAROL_ID,
      playerName: 'Carol',
      playerTokenHash: HASH_F,
      joinTokenHash: HASH_E,
    });

    const state = expectReady(await getViewer(t, HASH_F));
    expect(state.currentPlayerId).toBe(CAROL_ID);
  });

  it('rejects createInvite with a wrong player token', async () => {
    const t = await setupGame();
    await joinPlayer(t);

    await expectConvexError(
      t.mutation(api.games.createInvite, {
        gameId: GAME_ID,
        tokenHash: HASH_E,
        createdByPlayerId: BOB_ID,
        playerTokenHash: HASH_X,
      }),
      'UNAUTHORIZED'
    );
  });

  it('enforces the active invite limit', async () => {
    const t = await setupGame();

    for (let i = 0; i < 99; i++) {
      await t.mutation(api.games.createInvite, {
        gameId: GAME_ID,
        tokenHash: hashFor(4096 + i),
        createdByPlayerId: ALICE_ID,
        playerTokenHash: HASH_C,
        adminTokenHash: HASH_B,
      });
    }

    await expectConvexError(
      t.mutation(api.games.createInvite, {
        gameId: GAME_ID,
        tokenHash: hashFor(8192),
        createdByPlayerId: ALICE_ID,
        playerTokenHash: HASH_C,
        adminTokenHash: HASH_B,
      }),
      'TOO_MANY_INVITES'
    );
  });
});

describe('vote and leaveGame authorization', () => {
  it('rejects vote with a wrong player token', async () => {
    const t = await setupGame();

    await expectConvexError(
      t.mutation(api.games.vote, {
        gameId: GAME_ID,
        playerId: ALICE_ID,
        playerTokenHash: HASH_X,
        value: 1,
      }),
      'UNAUTHORIZED'
    );
  });

  it('rejects vote values that are not in the deck', async () => {
    const t = await setupGame();

    await expectConvexError(
      t.mutation(api.games.vote, {
        gameId: GAME_ID,
        playerId: ALICE_ID,
        playerTokenHash: HASH_C,
        value: 99,
      }),
      'INVALID_INPUT'
    );
  });

  it('rejects voting after reveal', async () => {
    const t = await setupGame();
    await t.mutation(api.games.reveal, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
    });

    await expectConvexError(
      t.mutation(api.games.vote, {
        gameId: GAME_ID,
        playerId: ALICE_ID,
        playerTokenHash: HASH_C,
        value: 1,
      }),
      'GAME_FINISHED'
    );
  });

  it('auto-reveals after the last active player votes', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.mutation(api.games.setAutoReveal, {
      gameId: GAME_ID,
      autoReveal: true,
      adminTokenHash: HASH_B,
    });

    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: ALICE_ID,
      playerTokenHash: HASH_C,
      value: 1,
    });
    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      playerTokenHash: HASH_D,
      value: 2,
    });

    const state = expectReady(await getViewer(t));
    expect(state.game.gameStatus).toBe(Status.Finished);
  });

  it('requires the right player token to leave a game', async () => {
    const t = await setupGame();

    await expectConvexError(
      t.mutation(api.games.leaveGame, {
        gameId: GAME_ID,
        playerId: ALICE_ID,
        playerTokenHash: HASH_X,
      }),
      'UNAUTHORIZED'
    );

    await t.mutation(api.games.leaveGame, {
      gameId: GAME_ID,
      playerId: ALICE_ID,
      playerTokenHash: HASH_C,
    });

    await expect(getViewer(t)).resolves.toEqual({
      type: 'revoked',
      reason: 'left',
    });
  });
});

describe('vote masking', () => {
  it('masks other players votes before reveal', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      playerTokenHash: HASH_D,
      value: 2,
    });

    const state = expectReady(await getViewer(t));
    const bob = getPlayer(state, BOB_ID);

    expect(state.game.gameStatus).toBe(Status.InProgress);
    expect(bob.status).toBe(Status.Finished);
    expect(bob.value).toBeUndefined();
    expect(bob.emoji).toBeUndefined();
  });

  it('keeps the current players own vote visible before reveal', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      playerTokenHash: HASH_D,
      value: 2,
    });

    const state = expectReady(await getViewer(t, HASH_D));
    const bob = getPlayer(state, BOB_ID);

    expect(state.currentPlayerId).toBe(BOB_ID);
    expect(state.game.gameStatus).toBe(Status.InProgress);
    expect(bob.status).toBe(Status.Finished);
    expect(bob.value).toBe(2);
  });

  it('shows all votes after reveal', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      playerTokenHash: HASH_D,
      value: 2,
    });
    await t.mutation(api.games.reveal, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
    });

    const state = expectReady(await getViewer(t));
    const bob = getPlayer(state, BOB_ID);

    expect(state.game.gameStatus).toBe(Status.Finished);
    expect(bob.value).toBe(2);
  });

  it('masks votes again after reset', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      playerTokenHash: HASH_D,
      value: 2,
    });
    await t.mutation(api.games.reveal, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
    });
    await t.mutation(api.games.reset, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
    });
    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      playerTokenHash: HASH_D,
      value: 2,
    });

    const state = expectReady(await getViewer(t));
    const bob = getPlayer(state, BOB_ID);

    expect(state.game.gameStatus).toBe(Status.InProgress);
    expect(bob.status).toBe(Status.Finished);
    expect(bob.value).toBeUndefined();
  });

  it('keeps auto-reveal end-state unmasked', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.mutation(api.games.setAutoReveal, {
      gameId: GAME_ID,
      autoReveal: true,
      adminTokenHash: HASH_B,
    });
    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: ALICE_ID,
      playerTokenHash: HASH_C,
      value: 1,
    });
    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      playerTokenHash: HASH_D,
      value: 2,
    });

    const state = expectReady(await getViewer(t));
    const alice = getPlayer(state, ALICE_ID);
    const bob = getPlayer(state, BOB_ID);

    expect(state.game.gameStatus).toBe(Status.Finished);
    expect(alice.value).toBe(1);
    expect(bob.value).toBe(2);
  });

  it('does not serialize foreign pre-reveal votes in player objects', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      playerTokenHash: HASH_D,
      value: 2,
    });

    const state = expectReady(await getViewer(t));
    const bob = getPlayer(state, BOB_ID);

    expect(JSON.stringify(bob)).not.toContain('2');
  });
});

describe('sanitized viewer output', () => {
  it('does not expose token hashes in ready payloads', async () => {
    const t = await setupGame();
    await joinPlayer(t);

    const state = expectReady(await getViewer(t));
    const serialized = JSON.stringify(state);

    expect(serialized).not.toContain(HASH_A);
    expect(serialized).not.toContain(HASH_B);
    expect(serialized).not.toContain(HASH_C);
    expect(serialized).not.toContain(HASH_D);
    expect(serialized).not.toContain('TokenHash');
  });
});

describe('updateTimer server stamping', () => {
  async function getStoredTimerProps(t: TestBackend) {
    return t.run(async (ctx) => {
      const game = await ctx.db
        .query('games')
        .withIndex('by_gameId', (q) => q.eq('gameId', GAME_ID))
        .unique();
      expect(game).not.toBeNull();
      return game?.timerProps as Record<string, unknown> | null | undefined;
    });
  }

  it('re-stamps start payloads with server time and strips elapsedSeconds', async () => {
    const t = await setupGame();
    const elapsedSeconds = 10;
    const before = Date.now();

    await t.mutation(api.games.updateTimer, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
      timerProps: {
        startedAt: Date.now() + 9_999_999,
        elapsedSeconds,
        pausedAt: null,
        totalSeconds: 300,
        soundOn: true,
      },
    });

    const after = Date.now();
    const timerProps = await getStoredTimerProps(t);
    const startedAt = timerProps?.startedAt;

    expect(timerProps).toMatchObject({
      pausedAt: null,
      totalSeconds: 300,
      soundOn: true,
    });
    expect(timerProps).not.toHaveProperty('elapsedSeconds');
    expect(typeof startedAt).toBe('number');
    expect(startedAt as number).toBeGreaterThanOrEqual(
      before - elapsedSeconds * 1000 - 2000
    );
    expect(startedAt as number).toBeLessThanOrEqual(
      after - elapsedSeconds * 1000 + 2000
    );
  });

  it('passes pause payloads through unchanged', async () => {
    const t = await setupGame();

    await t.mutation(api.games.updateTimer, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
      timerProps: {
        startedAt: null,
        pausedAt: 42,
        totalSeconds: 300,
        soundOn: false,
      },
    });

    await expect(getStoredTimerProps(t)).resolves.toEqual({
      startedAt: null,
      pausedAt: 42,
      totalSeconds: 300,
      soundOn: false,
    });
  });

  it('still rejects unauthorized timer updates', async () => {
    const t = await setupGame();

    await expectConvexError(
      t.mutation(api.games.updateTimer, {
        gameId: GAME_ID,
        adminTokenHash: HASH_X,
        timerProps: {
          startedAt: Date.now(),
          elapsedSeconds: 0,
          pausedAt: null,
          totalSeconds: 300,
          soundOn: true,
        },
      }),
      'UNAUTHORIZED'
    );
  });
});
