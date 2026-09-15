// @vitest-environment edge-runtime

import { convexTest } from 'convex-test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETENTION_MS } from '../lib/retention';
import { GameType } from '../types/game';
import { Status } from '../types/status';
import { api, internal } from './_generated/api';
import schema from './schema';
import { LIMITS } from './validation';

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
const SERVICE_SECRET = 'service-secret-'.padEnd(64, 's');

process.env.CONVEX_SERVICE_SECRET = SERVICE_SECRET;

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
    serviceSecret: SERVICE_SECRET,
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
    serviceSecret: SERVICE_SECRET,
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

describe('auto-reveal after membership and option changes', () => {
  it.each(['leave', 'remove', 'enable'] as const)(
    'reveals after %s',
    async (trigger) => {
      const t = await setupGame();
      if (trigger !== 'enable') {
        await joinPlayer(t);
        await t.mutation(api.games.setAutoReveal, {
          gameId: GAME_ID,
          adminTokenHash: HASH_B,
          autoReveal: true,
        });
      }
      await t.mutation(api.games.updateTimer, {
        gameId: GAME_ID,
        adminTokenHash: HASH_B,
        timerProps: { startedAt: null, totalSeconds: 300, pausedAt: 20 },
      });
      await t.mutation(api.games.vote, {
        gameId: GAME_ID,
        playerId: ALICE_ID,
        playerTokenHash: HASH_C,
        value: 1,
      });
      if (trigger === 'leave') {
        await t.mutation(api.games.leaveGame, {
          gameId: GAME_ID,
          playerId: BOB_ID,
          playerTokenHash: HASH_D,
        });
      } else if (trigger === 'remove') {
        await t.mutation(api.games.removePlayer, {
          gameId: GAME_ID,
          playerId: BOB_ID,
          adminTokenHash: HASH_B,
        });
      } else {
        await t.mutation(api.games.setAutoReveal, {
          gameId: GAME_ID,
          adminTokenHash: HASH_B,
          autoReveal: true,
        });
      }
      expect(expectReady(await getViewer(t)).game).toMatchObject({
        gameStatus: Status.Finished,
        timerProps: { startedAt: null, pausedAt: 0 },
      });
    }
  );

  it('does not reveal an empty game', async () => {
    const t = await setupGame();
    await t.mutation(api.games.setAutoReveal, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
      autoReveal: true,
    });
    await t.mutation(api.games.leaveGame, {
      gameId: GAME_ID,
      playerId: ALICE_ID,
      playerTokenHash: HASH_C,
    });
    const game = await t.run((ctx) => ctx.db.query('games').first());
    expect(game?.gameStatus).toBe(Status.Started);
  });
});

describe('rejoining with an existing session', () => {
  const join = {
    serviceSecret: SERVICE_SECRET,
    gameId: GAME_ID,
    playerId: CAROL_ID,
    playerName: 'Carol',
    playerTokenHash: HASH_E,
    joinTokenHash: HASH_A,
    existingPlayerTokenHash: HASH_D,
  };

  it('reuses an active player even for concurrent requests', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    const results = await Promise.all([
      t.mutation(api.games.joinGame, join),
      t.mutation(api.games.joinGame, {
        ...join,
        playerId: 'another-id',
        playerTokenHash: HASH_F,
      }),
    ]);
    expect(results).toEqual([
      { playerId: BOB_ID, reused: true },
      { playerId: BOB_ID, reused: true },
    ]);
    expect(expectReady(await getViewer(t)).players).toHaveLength(2);
  });

  it('still requires a valid invitation', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await expectConvexError(
      t.mutation(api.games.joinGame, { ...join, joinTokenHash: HASH_X }),
      'INVALID_INVITE'
    );
  });

  it('creates a fresh identity for a player who left', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.mutation(api.games.leaveGame, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      playerTokenHash: HASH_D,
    });
    await expect(t.mutation(api.games.joinGame, join)).resolves.toEqual({
      playerId: CAROL_ID,
      reused: false,
    });
    expect(await getViewer(t, HASH_D)).toEqual({
      type: 'revoked',
      reason: 'left',
    });
    expect(expectReady(await getViewer(t, HASH_E)).currentPlayerId).toBe(
      CAROL_ID
    );
  });
});

describe('server-only mutation authorization', () => {
  it('rejects game creation when the service secret is not configured', async () => {
    const configuredSecret = process.env.CONVEX_SERVICE_SECRET;
    delete process.env.CONVEX_SERVICE_SECRET;

    try {
      const t = createBackend();
      await expectConvexError(
        t.mutation(api.games.createGame, {
          serviceSecret: SERVICE_SECRET,
          gameId: GAME_ID,
          name: 'Test game',
          createdBy: 'Alice',
          createdById: ALICE_ID,
          gameType: GameType.Fibonacci,
          cards: CARDS,
          isAllowMembersToManageSession: false,
          joinTokenHash: HASH_A,
          adminTokenHash: HASH_B,
          playerTokenHash: HASH_C,
        }),
        'UNAUTHORIZED'
      );
    } finally {
      process.env.CONVEX_SERVICE_SECRET = configuredSecret;
    }
  });

  it('rejects direct game creation without the configured service secret', async () => {
    const t = createBackend();

    await expectConvexError(
      t.mutation(api.games.createGame, {
        serviceSecret: 'wrong-service-secret'.padEnd(64, 'x'),
        gameId: GAME_ID,
        name: 'Test game',
        createdBy: 'Alice',
        createdById: ALICE_ID,
        gameType: GameType.Fibonacci,
        cards: CARDS,
        isAllowMembersToManageSession: false,
        joinTokenHash: HASH_A,
        adminTokenHash: HASH_B,
        playerTokenHash: HASH_C,
      }),
      'UNAUTHORIZED'
    );
  });

  it('rejects direct joins without the configured service secret', async () => {
    const t = await setupGame();

    await expectConvexError(
      t.mutation(api.games.joinGame, {
        serviceSecret: 'wrong-service-secret'.padEnd(64, 'x'),
        gameId: GAME_ID,
        playerId: BOB_ID,
        playerName: 'Bob',
        playerTokenHash: HASH_D,
        joinTokenHash: HASH_A,
      }),
      'UNAUTHORIZED'
    );
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
        serviceSecret: SERVICE_SECRET,
        gameId: GAME_ID,
        playerId: CAROL_ID,
        playerName: 'Carol',
        playerTokenHash: HASH_F,
        joinTokenHash: HASH_A,
      }),
      'INVALID_INVITE'
    );
  });

  it('removes every legacy duplicate row for the selected player id', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert('players', {
        playerId: BOB_ID,
        gameId: GAME_ID,
        name: 'Legacy duplicate Bob',
        status: Status.NotStarted,
        membershipStatus: 'active',
        value: 0,
        emoji: null,
        createdAt: now,
        updatedAt: now,
        playerTokenHash: HASH_E,
      });
    });

    await t.mutation(api.games.removePlayer, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      adminTokenHash: HASH_B,
    });

    const duplicates = await t.run(async (ctx) =>
      ctx.db
        .query('players')
        .withIndex('by_gameId_playerId', (q) =>
          q.eq('gameId', GAME_ID).eq('playerId', BOB_ID)
        )
        .collect()
    );
    expect(duplicates).toHaveLength(2);
    expect(
      duplicates.every((player) => player.membershipStatus === 'removed')
    ).toBe(true);
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
        serviceSecret: SERVICE_SECRET,
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
        serviceSecret: SERVICE_SECRET,
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
        serviceSecret: SERVICE_SECRET,
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

  it('rejects a duplicate player id', async () => {
    const t = await setupGame();

    await expectConvexError(
      t.mutation(api.games.joinGame, {
        serviceSecret: SERVICE_SECRET,
        gameId: GAME_ID,
        playerId: ALICE_ID,
        playerName: 'Mallory',
        playerTokenHash: HASH_D,
        joinTokenHash: HASH_A,
      }),
      'INVALID_INPUT'
    );
  });

  it('rejects a duplicate player token hash', async () => {
    const t = await setupGame();

    await expectConvexError(
      t.mutation(api.games.joinGame, {
        serviceSecret: SERVICE_SECRET,
        gameId: GAME_ID,
        playerId: BOB_ID,
        playerName: 'Mallory',
        playerTokenHash: HASH_C,
        joinTokenHash: HASH_A,
      }),
      'INVALID_INPUT'
    );
  });

  it('prunes the oldest inactive row while keeping the total row budget', async () => {
    const t = await setupGame();

    await t.run(async (ctx) => {
      for (let i = 1; i < LIMITS.playersPerGame; i++) {
        const now = Date.now() + i;
        await ctx.db.insert('players', {
          playerId: `seed-player-${i}`,
          gameId: GAME_ID,
          name: `Seed player ${i}`,
          status: Status.NotStarted,
          membershipStatus: 'left',
          value: 0,
          emoji: null,
          createdAt: now,
          updatedAt: now,
          playerTokenHash: hashFor(10_000 + i),
        });
      }
    });

    await joinPlayer(t);

    const players = await t.run(async (ctx) =>
      ctx.db
        .query('players')
        .withIndex('by_gameId', (q) => q.eq('gameId', GAME_ID))
        .collect()
    );

    expect(players).toHaveLength(LIMITS.playersPerGame);
    expect(players.some((player) => player.playerId === BOB_ID)).toBe(true);
    expect(players.some((player) => player.playerId === 'seed-player-1')).toBe(
      false
    );
  });

  it('rejects joins when every player slot is active', async () => {
    const t = await setupGame();

    await t.run(async (ctx) => {
      for (let i = 1; i < LIMITS.playersPerGame; i++) {
        const now = Date.now() + i;
        await ctx.db.insert('players', {
          playerId: `active-player-${i}`,
          gameId: GAME_ID,
          name: `Active player ${i}`,
          status: Status.NotStarted,
          membershipStatus: 'active',
          value: 0,
          emoji: null,
          createdAt: now,
          updatedAt: now,
          playerTokenHash: hashFor(20_000 + i),
        });
      }
    });

    await expectConvexError(
      t.mutation(api.games.joinGame, {
        serviceSecret: SERVICE_SECRET,
        gameId: GAME_ID,
        playerId: BOB_ID,
        playerName: 'Bob',
        playerTokenHash: HASH_D,
        joinTokenHash: HASH_A,
      }),
      'TOO_MANY_PLAYERS'
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

  it('uses the player document identity when masking legacy duplicate ids', async () => {
    const t = await setupGame();
    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: ALICE_ID,
      playerTokenHash: HASH_C,
      value: 2,
    });

    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert('players', {
        playerId: ALICE_ID,
        gameId: GAME_ID,
        name: 'Mallory',
        status: Status.NotStarted,
        membershipStatus: 'active',
        value: 0,
        emoji: null,
        createdAt: now,
        updatedAt: now,
        playerTokenHash: HASH_D,
      });
    });

    const state = expectReady(await getViewer(t, HASH_D));
    const alice = state.players.find((player) => player.name === 'Alice');
    const mallory = state.players.find((player) => player.name === 'Mallory');

    expect(alice).toBeDefined();
    expect(mallory).toBeDefined();
    if (!alice || !mallory) throw new Error('Expected both duplicate-id rows');
    expect(alice.value).toBeUndefined();
    expect(alice.emoji).toBeUndefined();
    expect(mallory.value).toBe(0);
  });

  it('lets legacy duplicate rows vote independently before auto-reveal', async () => {
    const t = await setupGame();
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert('players', {
        playerId: ALICE_ID,
        gameId: GAME_ID,
        name: 'Legacy duplicate Alice',
        status: Status.NotStarted,
        membershipStatus: 'active',
        value: 0,
        emoji: null,
        createdAt: now,
        updatedAt: now,
        playerTokenHash: HASH_D,
      });
    });
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
    expect(expectReady(await getViewer(t)).game.gameStatus).toBe(
      Status.InProgress
    );

    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: ALICE_ID,
      playerTokenHash: HASH_D,
      value: 2,
    });
    expect(expectReady(await getViewer(t)).game.gameStatus).toBe(
      Status.Finished
    );
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
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  async function getStoredGame(t: TestBackend) {
    return t.run(async (ctx) => {
      const game = await ctx.db
        .query('games')
        .withIndex('by_gameId', (q) => q.eq('gameId', GAME_ID))
        .unique();
      expect(game).not.toBeNull();
      if (!game) throw new Error('Expected stored game');
      return game;
    });
  }

  async function getStoredTimerProps(t: TestBackend) {
    const game = await getStoredGame(t);
    return game.timerProps as Record<string, unknown> | null | undefined;
  }

  async function getScheduledFunctionCount(t: TestBackend) {
    return t.run(async (ctx) => {
      const scheduledFunctions = await ctx.db.system
        .query('_scheduled_functions')
        .collect();
      return scheduledFunctions.length;
    });
  }

  async function startTimer(
    t: TestBackend,
    options: { elapsedSeconds?: number; totalSeconds?: number } = {}
  ) {
    await t.mutation(api.games.updateTimer, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
      timerProps: {
        startedAt: Date.now() + 9_999_999,
        elapsedSeconds: options.elapsedSeconds ?? 0,
        pausedAt: null,
        totalSeconds: options.totalSeconds ?? 60,
        soundOn: true,
      },
    });

    const timerProps = await getStoredTimerProps(t);
    const startedAt = timerProps?.startedAt;
    const totalSeconds = timerProps?.totalSeconds;
    expect(typeof startedAt).toBe('number');
    expect(typeof totalSeconds).toBe('number');
    return {
      startedAt: startedAt as number,
      totalSeconds: totalSeconds as number,
    };
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

  it('rejects a new client-provided start timestamp without elapsedSeconds', async () => {
    const t = await setupGame();

    await expectConvexError(
      t.mutation(api.games.updateTimer, {
        gameId: GAME_ID,
        adminTokenHash: HASH_B,
        timerProps: {
          startedAt: Date.now(),
          pausedAt: null,
          totalSeconds: 60,
          soundOn: true,
        },
      }),
      'INVALID_INPUT'
    );
  });

  it('accepts an echoed start timestamp without scheduling a duplicate', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const t = await setupGame();
    const schedule = await startTimer(t);

    await expect(getScheduledFunctionCount(t)).resolves.toBe(1);

    await t.mutation(api.games.updateTimer, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
      timerProps: {
        startedAt: schedule.startedAt,
        pausedAt: null,
        totalSeconds: schedule.totalSeconds,
        soundOn: false,
      },
    });

    await expect(getScheduledFunctionCount(t)).resolves.toBe(1);
    await expect(getStoredTimerProps(t)).resolves.toMatchObject({
      startedAt: schedule.startedAt,
      totalSeconds: schedule.totalSeconds,
      soundOn: false,
    });
  });

  it('replaces a stale optimistic start echo with the server timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const t = await setupGame();
    const schedule = await startTimer(t);

    await t.mutation(api.games.updateTimer, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
      timerProps: {
        startedAt: schedule.startedAt + 5000,
        pausedAt: null,
        totalSeconds: schedule.totalSeconds,
        soundOn: false,
      },
    });

    await expect(getScheduledFunctionCount(t)).resolves.toBe(1);
    await expect(getStoredTimerProps(t)).resolves.toMatchObject({
      startedAt: schedule.startedAt,
      totalSeconds: schedule.totalSeconds,
      soundOn: false,
    });
  });

  it('finishes the game and records completion at the scheduled deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const t = await setupGame();
    await startTimer(t);

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    const game = await getStoredGame(t);
    expect(game.gameStatus).toBe(Status.Finished);
    expect(game.timerProps).toMatchObject({
      startedAt: null,
      pausedAt: 0,
      totalSeconds: 60,
      soundOn: true,
    });
    expect(game.timerCompletedAt).toBe(1_800_000_060_000);
    expect(expectReady(await getViewer(t)).game.timerCompletedAt).toBe(
      1_800_000_060_000
    );
  });

  it('finishes at the deadline even when autoReveal is enabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const t = await setupGame();
    await t.mutation(api.games.setAutoReveal, {
      gameId: GAME_ID,
      autoReveal: true,
      adminTokenHash: HASH_B,
    });
    await startTimer(t);

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    const game = await getStoredGame(t);
    expect(game.gameStatus).toBe(Status.Finished);
    expect(game.timerCompletedAt).toBe(1_800_000_060_000);
  });

  it('ignores completion after the timer is paused', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const t = await setupGame();
    const schedule = await startTimer(t);

    await t.mutation(api.games.updateTimer, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
      timerProps: {
        startedAt: null,
        pausedAt: 10,
        totalSeconds: 60,
        soundOn: true,
      },
    });
    await t.mutation(internal.games.completeTimer, {
      gameId: GAME_ID,
      ...schedule,
    });

    const game = await getStoredGame(t);
    expect(game.gameStatus).toBe(Status.Started);
    expect(game.timerCompletedAt).toBeUndefined();
  });

  it('ignores completion after a round reset', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const t = await setupGame();
    const schedule = await startTimer(t);

    await t.mutation(api.games.reset, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
    });
    await t.mutation(internal.games.completeTimer, {
      gameId: GAME_ID,
      ...schedule,
    });

    const game = await getStoredGame(t);
    expect(game.gameStatus).toBe(Status.Started);
    expect(game.timerCompletedAt).toBeUndefined();
  });

  it('ignores completion after a manual reveal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const t = await setupGame();
    const schedule = await startTimer(t);

    await t.mutation(api.games.reveal, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
    });
    await t.mutation(internal.games.completeTimer, {
      gameId: GAME_ID,
      ...schedule,
    });

    const game = await getStoredGame(t);
    expect(game.gameStatus).toBe(Status.Finished);
    expect(game.timerCompletedAt).toBeUndefined();
  });

  it('ignores completion after an early auto-reveal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const t = await setupGame();
    await t.mutation(api.games.setAutoReveal, {
      gameId: GAME_ID,
      autoReveal: true,
      adminTokenHash: HASH_B,
    });
    const schedule = await startTimer(t);

    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: ALICE_ID,
      playerTokenHash: HASH_C,
      value: 1,
    });
    await t.mutation(internal.games.completeTimer, {
      gameId: GAME_ID,
      ...schedule,
    });

    const game = await getStoredGame(t);
    expect(game.gameStatus).toBe(Status.Finished);
    expect(game.timerCompletedAt).toBeUndefined();
  });

  it('ignores completion after the game is deleted', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const t = await setupGame();
    const schedule = await startTimer(t);

    await t.mutation(api.games.deleteGame, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
    });

    await expect(
      t.mutation(internal.games.completeTimer, {
        gameId: GAME_ID,
        ...schedule,
      })
    ).resolves.toBeNull();
  });

  it('only lets the latest restart complete the timer', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const t = await setupGame();
    const staleSchedule = await startTimer(t);

    vi.setSystemTime(1_800_000_010_000);
    const currentSchedule = await startTimer(t, {
      elapsedSeconds: 5,
      totalSeconds: 120,
    });

    await t.mutation(internal.games.completeTimer, {
      gameId: GAME_ID,
      ...staleSchedule,
    });
    expect((await getStoredGame(t)).timerCompletedAt).toBeUndefined();

    await t.mutation(internal.games.completeTimer, {
      gameId: GAME_ID,
      ...currentSchedule,
    });
    const completedAt = (await getStoredGame(t)).timerCompletedAt;
    expect(completedAt).toBe(1_800_000_010_000);

    await t.mutation(internal.games.completeTimer, {
      gameId: GAME_ID,
      ...currentSchedule,
    });
    expect((await getStoredGame(t)).timerCompletedAt).toBe(completedAt);
  });

  it('reschedules a changed duration without letting the old deadline win', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const t = await setupGame();
    const staleSchedule = await startTimer(t);

    await t.mutation(api.games.updateTimer, {
      gameId: GAME_ID,
      adminTokenHash: HASH_B,
      timerProps: {
        startedAt: staleSchedule.startedAt,
        pausedAt: null,
        totalSeconds: 120,
        soundOn: true,
      },
    });

    await expect(getScheduledFunctionCount(t)).resolves.toBe(2);
    await t.mutation(internal.games.completeTimer, {
      gameId: GAME_ID,
      ...staleSchedule,
    });
    expect((await getStoredGame(t)).timerCompletedAt).toBeUndefined();

    await t.mutation(internal.games.completeTimer, {
      gameId: GAME_ID,
      startedAt: staleSchedule.startedAt,
      totalSeconds: 120,
    });
    expect((await getStoredGame(t)).timerCompletedAt).toBe(1_800_000_000_000);
  });
});

describe('30-day retention', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
  });
  afterEach(() => vi.useRealTimers());

  async function ageGame(t: TestBackend, age = RETENTION_MS) {
    await t.run(async (ctx) => {
      const game = await ctx.db.query('games').first();
      if (!game) throw new Error('missing fixture');
      await ctx.db.patch(game._id, {
        createdAt: Date.now() - age,
        updatedAt: Date.now() - age,
      });
    });
  }

  it('keeps expired games and their children when retention is paused', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await ageGame(t, RETENTION_MS * 2);
    vi.stubEnv('GAME_RETENTION_PAUSED', 'true');
    try {
      expect(await t.mutation(internal.retention.purgeInactiveGames, {})).toBe(
        0
      );
      await t.run(async (ctx) => {
        expect(await ctx.db.query('games').collect()).toHaveLength(1);
        expect(await ctx.db.query('players').collect()).toHaveLength(2);
        expect(await ctx.db.query('gameInvites').collect()).toHaveLength(1);
        expect(
          await ctx.db.system.query('_scheduled_functions').collect()
        ).toHaveLength(0);
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('deletes a game, all memberships and invitations at the 30-day boundary', async () => {
    const t = await setupGame();
    await joinPlayer(t);
    await t.mutation(api.games.leaveGame, {
      gameId: GAME_ID,
      playerId: BOB_ID,
      playerTokenHash: HASH_D,
    });
    await ageGame(t);
    expect(await t.mutation(internal.retention.purgeInactiveGames, {})).toBe(1);
    await t.run(async (ctx) => {
      expect(await ctx.db.query('games').collect()).toEqual([]);
      expect(await ctx.db.query('players').collect()).toEqual([]);
      expect(await ctx.db.query('gameInvites').collect()).toEqual([]);
    });
    await expect(getViewer(t)).resolves.toEqual({ type: 'not_found' });
    await expect(
      t.mutation(internal.games.completeTimer, {
        gameId: GAME_ID,
        startedAt: Date.now() - 60000,
        totalSeconds: 60,
      })
    ).resolves.toBeNull();
  });

  it('retains games until the complete 30 days have elapsed', async () => {
    const t = await setupGame();
    await ageGame(t, RETENTION_MS - 1);
    expect(await t.mutation(internal.retention.purgeInactiveGames, {})).toBe(0);
    expectReady(await getViewer(t));
  });

  it('uses last activity, including votes, rather than creation time', async () => {
    const t = await setupGame();
    await ageGame(t, RETENTION_MS * 2);
    await t.mutation(api.games.vote, {
      gameId: GAME_ID,
      playerId: ALICE_ID,
      playerTokenHash: HASH_C,
      value: 1,
    });
    expect(await t.mutation(internal.retention.purgeInactiveGames, {})).toBe(0);
    expectReady(await getViewer(t));
  });

  it('continues in bounded batches and rechecks activity between them', async () => {
    const t = await setupGame();
    await ageGame(t);
    await t.run(async (ctx) => {
      const original = await ctx.db.query('games').first();
      if (!original) throw new Error('missing fixture');
      const { _id, _creationTime, ...game } = original;
      for (let i = 0; i < 12; i++) {
        await ctx.db.insert('games', { ...game, gameId: `old-${i}` });
      }
      await ctx.db.insert('games', {
        ...game,
        gameId: 'fresh',
        updatedAt: Date.now(),
      });
    });
    expect(await t.mutation(internal.retention.purgeInactiveGames, {})).toBe(
      10
    );
    const revived = await t.run(async (ctx) => {
      const games = await ctx.db.query('games').collect();
      expect(games).toHaveLength(4);
      const game = games.find((row) => row.gameId !== 'fresh');
      if (!game) throw new Error('missing remaining game');
      await ctx.db.patch(game._id, { updatedAt: Date.now() });
      return game.gameId;
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const remaining = await t.run((ctx) => ctx.db.query('games').collect());
    expect(remaining.map((game) => game.gameId).sort()).toEqual(
      ['fresh', revived].sort()
    );
  });

  it('expires invitations by creation date without expiring an active game', async () => {
    const t = await setupGame();
    vi.setSystemTime(Date.now() + RETENTION_MS);
    await expectConvexError(joinPlayer(t), 'INVALID_INVITE');
    await t.mutation(api.games.createInvite, {
      gameId: GAME_ID,
      tokenHash: HASH_E,
      createdByPlayerId: ALICE_ID,
      playerTokenHash: HASH_C,
    });
    await joinPlayer(t, { joinTokenHash: HASH_E });
    expect(await t.mutation(internal.retention.purgeInactiveGames, {})).toBe(0);
  });

  it('expires legacy invitation tokens even if the game is still active', async () => {
    const t = await setupGame();
    await deleteAllInvites(t);
    await ageGame(t);
    await expectConvexError(joinPlayer(t), 'INVALID_INVITE');
  });

  it('recycles expired invitations while keeping the row budget and no legacy fallback', async () => {
    const t = await setupGame();
    await t.run(async (ctx) => {
      for (let i = 0; i < LIMITS.invitesPerGame - 1; i++) {
        await ctx.db.insert('gameInvites', {
          gameId: GAME_ID,
          tokenHash: hashFor(i + 200),
          createdByPlayerId: ALICE_ID,
          createdAt: Date.now(),
          revokedAt: null,
        });
      }
    });
    vi.setSystemTime(Date.now() + RETENTION_MS);
    await t.mutation(api.games.createInvite, {
      gameId: GAME_ID,
      tokenHash: HASH_E,
      createdByPlayerId: ALICE_ID,
      playerTokenHash: HASH_C,
    });
    const invites = await t.run((ctx) => ctx.db.query('gameInvites').collect());
    expect(invites).toHaveLength(LIMITS.invitesPerGame);
    await expectConvexError(joinPlayer(t), 'INVALID_INVITE');
    await joinPlayer(t, { joinTokenHash: HASH_E });
  });
});
