import { ConvexError, v } from 'convex/values';
import { RETENTION_MS } from '../lib/retention';

import type { Game } from '../types/game';
import type { Player } from '../types/player';
import { Status } from '../types/status';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import {
  type DatabaseReader,
  internalMutation,
  type MutationCtx,
  mutation,
  query,
} from './_generated/server';
import { deleteGameData } from './gameDeletion';
import {
  assertCards,
  assertGameType,
  assertId,
  assertText,
  assertTimerInput,
  assertTokenHash,
  isAllowedVoteValue,
  LIMITS,
  pickTimerFields,
  timingSafeStringEqual,
} from './validation';

const STATUS = Status;
const MEMBERSHIP = {
  Active: 'active',
  Left: 'left',
  Removed: 'removed',
} as const;

type MembershipStatus = (typeof MEMBERSHIP)[keyof typeof MEMBERSHIP];
type ViewerRevokedReason = 'left' | 'missing-session' | 'removed';

type GameDoc = Doc<'games'>;
type PlayerDoc = Doc<'players'>;
type GameInviteDoc = Doc<'gameInvites'>;
type DbReaderCtx = { db: DatabaseReader };

const SERVICE_SECRET_MIN_LENGTH = 32;

function assertServiceSecret(serviceSecret: string) {
  const expected = process.env.CONVEX_SERVICE_SECRET;
  if (
    !expected ||
    expected.length < SERVICE_SECRET_MIN_LENGTH ||
    !timingSafeStringEqual(serviceSecret, expected)
  ) {
    throw new ConvexError('UNAUTHORIZED');
  }
}

const resetTimerProps = (timerProps: unknown) => {
  if (timerProps === undefined) return undefined;
  if (timerProps === null) return null;
  return {
    ...pickTimerFields(timerProps),
    startedAt: null,
    pausedAt: 0,
  };
};

function getMembershipStatus(player: PlayerDoc): MembershipStatus {
  return (
    (player.membershipStatus as MembershipStatus | undefined) ??
    MEMBERSHIP.Active
  );
}

function isActivePlayer(player: PlayerDoc) {
  return getMembershipStatus(player) === MEMBERSHIP.Active;
}

function sanitizeGame(game: GameDoc): Game {
  return {
    id: game.gameId,
    name: game.name,
    gameType: game.gameType as Game['gameType'],
    cards: game.cards as Game['cards'],
    createdBy: game.createdBy,
    createdById: game.createdById,
    isAllowMembersToManageSession: game.isAllowMembersToManageSession,
    storyName: game.storyName ?? undefined,
    autoReveal: game.autoReveal,
    gameStatus: game.gameStatus as Status,
    timerProps:
      game.timerProps === null || game.timerProps === undefined
        ? undefined
        : (game.timerProps as Game['timerProps']),
    timerCompletedAt: game.timerCompletedAt,
    createdAt: new Date(game.createdAt).toISOString(),
    updatedAt: new Date(game.updatedAt).toISOString(),
  };
}

function sanitizePlayer(player: PlayerDoc): Player {
  return {
    id: player.playerId,
    name: player.name,
    status: player.status as Status,
    value: player.value ?? undefined,
    emoji: player.emoji ?? undefined,
  };
}

async function getGameByGameId(ctx: DbReaderCtx, gameId: string) {
  const results = (await ctx.db
    .query('games')
    .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
    .collect()) as GameDoc[];
  return results[0] ?? null;
}

async function getPlayersByGameId(ctx: DbReaderCtx, gameId: string) {
  return (await ctx.db
    .query('players')
    .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
    .collect()) as PlayerDoc[];
}

async function getActivePlayersByGameId(ctx: DbReaderCtx, gameId: string) {
  return (await getPlayersByGameId(ctx, gameId))
    .filter(isActivePlayer)
    .sort((a, b) => a.createdAt - b.createdAt);
}

async function getAutoRevealPatch(ctx: DbReaderCtx, game: GameDoc) {
  if (!game.autoReveal || game.gameStatus === STATUS.Finished) return {};
  const players = await getActivePlayersByGameId(ctx, game.gameId);
  if (!players.length || players.some((p) => p.status !== STATUS.Finished)) {
    return {};
  }
  const timerProps = resetTimerProps(game.timerProps);
  return {
    gameStatus: STATUS.Finished,
    ...(timerProps !== undefined ? { timerProps } : {}),
  };
}

async function getPlayersByGameAndPlayerId(
  ctx: DbReaderCtx,
  gameId: string,
  playerId: string
) {
  return (await ctx.db
    .query('players')
    .withIndex('by_gameId_playerId', (q) =>
      q.eq('gameId', gameId).eq('playerId', playerId)
    )
    .collect()) as PlayerDoc[];
}

async function getPlayerByGameAndPlayerId(
  ctx: DbReaderCtx,
  gameId: string,
  playerId: string
) {
  const results = await getPlayersByGameAndPlayerId(ctx, gameId, playerId);
  return results[0] ?? null;
}

async function getPlayerByGameAndPlayerTokenHash(
  ctx: DbReaderCtx,
  gameId: string,
  playerTokenHash: string
) {
  return (await ctx.db
    .query('players')
    .withIndex('by_gameId_playerTokenHash', (q) =>
      q.eq('gameId', gameId).eq('playerTokenHash', playerTokenHash)
    )
    .first()) as PlayerDoc | null;
}

async function getPlayerByGameAndCredentials(
  ctx: DbReaderCtx,
  gameId: string,
  playerId: string,
  playerTokenHash: string
) {
  const player = await getPlayerByGameAndPlayerTokenHash(
    ctx,
    gameId,
    playerTokenHash
  );
  return player?.playerId === playerId ? player : null;
}

async function hasValidInviteToken(
  ctx: DbReaderCtx,
  game: GameDoc,
  tokenHash: string
) {
  const match = (await ctx.db
    .query('gameInvites')
    .withIndex('by_gameId_tokenHash', (q) =>
      q.eq('gameId', game.gameId).eq('tokenHash', tokenHash)
    )
    .first()) as GameInviteDoc | null;
  if (match) {
    return (
      match.revokedAt === null && match.createdAt > Date.now() - RETENTION_MS
    );
  }

  // Legacy fallback for games created before invite rows existed. Bounded to a
  // single read so it can't be turned into a scan.
  const anyInvite = await ctx.db
    .query('gameInvites')
    .withIndex('by_gameId', (q) => q.eq('gameId', game.gameId))
    .first();
  if (anyInvite) return false;
  return (
    game.createdAt > Date.now() - RETENTION_MS &&
    timingSafeStringEqual(tokenHash, game.joinTokenHash)
  );
}

// Enforces the per-game invite budget before inserting a new invite row.
// Only ACTIVE invites count toward the quota, so revoked rows can never
// permanently exhaust it. When the row budget is full, the oldest revoked
// rows are pruned to make room — never below LIMITS.invitesPerGame - 1 rows,
// so a game that ever had invite rows keeps at least one and the legacy
// join-token fallback (zero rows) cannot be re-enabled.
async function reserveInviteSlot(ctx: MutationCtx, gameId: string) {
  const rows = (await ctx.db
    .query('gameInvites')
    .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
    .take(LIMITS.invitesPerGame + 1)) as GameInviteDoc[];

  const cutoff = Date.now() - RETENTION_MS;
  const activeCount = rows.filter(
    (row) => row.revokedAt === null && row.createdAt > cutoff
  ).length;
  if (activeCount >= LIMITS.invitesPerGame) {
    throw new ConvexError('TOO_MANY_INVITES');
  }

  const overflow = rows.length - (LIMITS.invitesPerGame - 1);
  if (overflow > 0) {
    const prunable = rows
      .filter((row) => row.revokedAt !== null || row.createdAt <= cutoff)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, overflow);
    await Promise.all(prunable.map((row) => ctx.db.delete(row._id)));
  }
}

async function reservePlayerSlot(
  ctx: MutationCtx,
  gameId: string,
  playerId: string,
  playerTokenHash: string
) {
  const existingPlayer = await getPlayerByGameAndPlayerId(
    ctx,
    gameId,
    playerId
  );
  if (existingPlayer) throw new ConvexError('INVALID_INPUT');

  const existingToken = await getPlayerByGameAndPlayerTokenHash(
    ctx,
    gameId,
    playerTokenHash
  );
  if (existingToken) throw new ConvexError('INVALID_INPUT');

  const players = (await ctx.db
    .query('players')
    .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
    .take(LIMITS.playersPerGame + 1)) as PlayerDoc[];
  const activeCount = players.filter(isActivePlayer).length;
  if (activeCount >= LIMITS.playersPerGame) {
    throw new ConvexError('TOO_MANY_PLAYERS');
  }

  // Keep the total row count bounded without letting left or removed players
  // permanently exhaust the room. One slot must remain for the pending insert.
  const overflow = players.length - (LIMITS.playersPerGame - 1);
  if (overflow > 0) {
    const prunable = players
      .filter((player) => !isActivePlayer(player))
      .sort((a, b) => a.updatedAt - b.updatedAt || a.createdAt - b.createdAt)
      .slice(0, overflow);
    if (prunable.length < overflow) {
      throw new ConvexError('TOO_MANY_PLAYERS');
    }
    await Promise.all(prunable.map((player) => ctx.db.delete(player._id)));
  }
}

async function revokeActiveInvites(
  ctx: MutationCtx,
  gameId: string,
  revokedReason: string,
  revokedAt: number
) {
  const invites = (await ctx.db
    .query('gameInvites')
    .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
    .collect()) as GameInviteDoc[];

  await Promise.all(
    invites
      .filter((invite) => invite.revokedAt === null)
      .map((invite) =>
        ctx.db.patch(invite._id, {
          revokedAt,
          revokedReason,
        })
      )
  );
}

async function assertCanManage(
  ctx: DbReaderCtx,
  game: GameDoc,
  adminTokenHash?: string | null,
  callerPlayerId?: string | null,
  playerTokenHash?: string | null
) {
  if (
    adminTokenHash &&
    timingSafeStringEqual(adminTokenHash, game.adminTokenHash)
  ) {
    return true;
  }
  if (!game.isAllowMembersToManageSession) return false;
  if (!callerPlayerId || !playerTokenHash) return false;

  const caller = await getPlayerByGameAndCredentials(
    ctx,
    game.gameId,
    callerPlayerId,
    playerTokenHash
  );

  return Boolean(caller && isActivePlayer(caller));
}

async function assertCanCreateInvite(
  ctx: DbReaderCtx,
  game: GameDoc,
  playerId: string,
  playerTokenHash: string,
  adminTokenHash?: string | null
) {
  if (
    adminTokenHash &&
    timingSafeStringEqual(adminTokenHash, game.adminTokenHash)
  ) {
    return true;
  }

  const caller = await getPlayerByGameAndCredentials(
    ctx,
    game.gameId,
    playerId,
    playerTokenHash
  );

  return Boolean(caller && isActivePlayer(caller));
}

async function getViewerState(
  ctx: DbReaderCtx,
  gameId: string,
  playerTokenHash: string
): Promise<
  | {
      type: 'not_found';
    }
  | {
      type: 'revoked';
      reason: ViewerRevokedReason;
    }
  | {
      type: 'ready';
      currentPlayerId: string;
      game: Game;
      players: Player[];
    }
> {
  const game = await getGameByGameId(ctx, gameId);
  if (!game) {
    return { type: 'not_found' };
  }

  const viewer = await getPlayerByGameAndPlayerTokenHash(
    ctx,
    gameId,
    playerTokenHash
  );
  if (!viewer) {
    return { type: 'revoked', reason: 'missing-session' };
  }

  const membershipStatus = getMembershipStatus(viewer);
  if (membershipStatus === MEMBERSHIP.Left) {
    return { type: 'revoked', reason: 'left' };
  }
  if (membershipStatus === MEMBERSHIP.Removed) {
    return { type: 'revoked', reason: 'removed' };
  }

  const players = await getActivePlayersByGameId(ctx, gameId);
  const revealed = game.gameStatus === STATUS.Finished;

  return {
    type: 'ready',
    currentPlayerId: viewer.playerId,
    game: sanitizeGame(game),
    players: players.map((player) => {
      const sanitized = sanitizePlayer(player);
      if (revealed || player._id === viewer._id) return sanitized;
      return { ...sanitized, value: undefined, emoji: undefined };
    }),
  };
}

export const getViewerGameState = query({
  args: {
    gameId: v.string(),
    playerTokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    return getViewerState(ctx, args.gameId, args.playerTokenHash);
  },
});

export const createGame = mutation({
  args: {
    serviceSecret: v.string(),
    gameId: v.string(),
    name: v.string(),
    createdBy: v.string(),
    createdById: v.string(),
    gameType: v.string(),
    cards: v.array(v.any()),
    isAllowMembersToManageSession: v.boolean(),
    joinTokenHash: v.string(),
    adminTokenHash: v.string(),
    playerTokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    assertServiceSecret(args.serviceSecret);
    const gameId = assertId(args.gameId);
    const createdById = assertId(args.createdById);
    const name = assertText(args.name, LIMITS.name);
    const createdBy = assertText(args.createdBy, LIMITS.personName);
    const gameType = assertGameType(args.gameType);
    assertTokenHash(args.joinTokenHash);
    assertTokenHash(args.adminTokenHash);
    assertTokenHash(args.playerTokenHash);
    const cards = assertCards(args.cards);

    const existing = await getGameByGameId(ctx, gameId);
    if (existing) throw new ConvexError('INVALID_INPUT');

    const now = Date.now();

    await ctx.db.insert('games', {
      gameId,
      name,
      gameType,
      cards,
      createdBy,
      createdById,
      isAllowMembersToManageSession: args.isAllowMembersToManageSession,
      storyName: null,
      autoReveal: false,
      gameStatus: STATUS.Started,
      timerProps: null,
      createdAt: now,
      updatedAt: now,
      joinTokenHash: args.joinTokenHash,
      adminTokenHash: args.adminTokenHash,
    });

    await ctx.db.insert('players', {
      playerId: createdById,
      gameId,
      name: createdBy,
      status: STATUS.NotStarted,
      membershipStatus: MEMBERSHIP.Active,
      value: 0,
      emoji: null,
      createdAt: now,
      updatedAt: now,
      playerTokenHash: args.playerTokenHash,
    });

    await ctx.db.insert('gameInvites', {
      gameId,
      tokenHash: args.joinTokenHash,
      createdByPlayerId: createdById,
      createdAt: now,
      revokedAt: null,
    });
  },
});

export const createInvite = mutation({
  args: {
    gameId: v.string(),
    tokenHash: v.string(),
    createdByPlayerId: v.string(),
    playerTokenHash: v.string(),
    adminTokenHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertTokenHash(args.tokenHash);

    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new ConvexError('NOT_FOUND');

    const authorized = await assertCanCreateInvite(
      ctx,
      game,
      args.createdByPlayerId,
      args.playerTokenHash,
      args.adminTokenHash ?? null
    );
    if (!authorized) throw new ConvexError('UNAUTHORIZED');

    await reserveInviteSlot(ctx, args.gameId);

    const now = Date.now();
    await ctx.db.insert('gameInvites', {
      gameId: args.gameId,
      tokenHash: args.tokenHash,
      createdByPlayerId: args.createdByPlayerId,
      createdAt: now,
      revokedAt: null,
    });

    await ctx.db.patch(game._id, { updatedAt: now });
  },
});

export const joinGame = mutation({
  args: {
    serviceSecret: v.string(),
    gameId: v.string(),
    playerId: v.string(),
    playerName: v.string(),
    playerTokenHash: v.string(),
    joinTokenHash: v.string(),
    existingPlayerTokenHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertServiceSecret(args.serviceSecret);
    const playerName = assertText(args.playerName, LIMITS.personName);
    assertId(args.playerId);
    assertTokenHash(args.playerTokenHash);
    assertTokenHash(args.joinTokenHash);

    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new ConvexError('NOT_FOUND');

    const hasValidInvite = await hasValidInviteToken(
      ctx,
      game,
      args.joinTokenHash
    );
    if (!hasValidInvite) {
      throw new ConvexError('INVALID_INVITE');
    }

    if (args.existingPlayerTokenHash) {
      assertTokenHash(args.existingPlayerTokenHash);
      const existing = await getPlayerByGameAndPlayerTokenHash(
        ctx,
        args.gameId,
        args.existingPlayerTokenHash
      );
      if (existing && isActivePlayer(existing)) {
        await ctx.db.patch(game._id, { updatedAt: Date.now() });
        return { playerId: existing.playerId, reused: true };
      }
    }

    await reservePlayerSlot(
      ctx,
      args.gameId,
      args.playerId,
      args.playerTokenHash
    );

    const now = Date.now();
    await ctx.db.insert('players', {
      playerId: args.playerId,
      gameId: args.gameId,
      name: playerName,
      status: STATUS.NotStarted,
      membershipStatus: MEMBERSHIP.Active,
      value: 0,
      emoji: null,
      createdAt: now,
      updatedAt: now,
      playerTokenHash: args.playerTokenHash,
    });

    await ctx.db.patch(game._id, { updatedAt: now });
    return { playerId: args.playerId, reused: false };
  },
});

export const leaveGame = mutation({
  args: {
    gameId: v.string(),
    playerId: v.string(),
    playerTokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new ConvexError('NOT_FOUND');

    const player = await getPlayerByGameAndCredentials(
      ctx,
      args.gameId,
      args.playerId,
      args.playerTokenHash
    );
    if (!player || !isActivePlayer(player)) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const now = Date.now();
    await ctx.db.patch(player._id, {
      membershipStatus: MEMBERSHIP.Left,
      status: STATUS.NotStarted,
      value: 0,
      emoji: null,
      updatedAt: now,
    });
    await ctx.db.patch(game._id, {
      ...(await getAutoRevealPatch(ctx, game)),
      updatedAt: now,
    });
  },
});

export const vote = mutation({
  args: {
    gameId: v.string(),
    playerId: v.string(),
    playerTokenHash: v.string(),
    value: v.number(),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new ConvexError('NOT_FOUND');

    const player = await getPlayerByGameAndCredentials(
      ctx,
      args.gameId,
      args.playerId,
      args.playerTokenHash
    );
    if (!player || !isActivePlayer(player)) {
      throw new ConvexError('UNAUTHORIZED');
    }

    if (game.gameStatus === STATUS.Finished) {
      throw new ConvexError('GAME_FINISHED');
    }

    if (!isAllowedVoteValue(game.cards, args.value)) {
      throw new ConvexError('INVALID_INPUT');
    }
    if (args.emoji !== undefined && args.emoji.length > LIMITS.emoji) {
      throw new ConvexError('INVALID_INPUT');
    }

    const now = Date.now();
    await ctx.db.patch(player._id, {
      value: args.value,
      emoji: args.emoji ?? null,
      status: STATUS.Finished,
      updatedAt: now,
    });

    await ctx.db.patch(game._id, {
      gameStatus: STATUS.InProgress,
      ...(await getAutoRevealPatch(ctx, game)),
      updatedAt: now,
    });
  },
});

export const reveal = mutation({
  args: {
    gameId: v.string(),
    adminTokenHash: v.optional(v.string()),
    callerPlayerId: v.optional(v.string()),
    playerTokenHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new ConvexError('NOT_FOUND');

    const authorized = await assertCanManage(
      ctx,
      game,
      args.adminTokenHash ?? null,
      args.callerPlayerId ?? null,
      args.playerTokenHash ?? null
    );
    if (!authorized) throw new ConvexError('UNAUTHORIZED');

    const now = Date.now();
    const nextTimerProps = resetTimerProps(game.timerProps);

    await ctx.db.patch(game._id, {
      gameStatus: STATUS.Finished,
      ...(nextTimerProps !== undefined ? { timerProps: nextTimerProps } : {}),
      updatedAt: now,
    });
  },
});

export const reset = mutation({
  args: {
    gameId: v.string(),
    adminTokenHash: v.optional(v.string()),
    callerPlayerId: v.optional(v.string()),
    playerTokenHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new ConvexError('NOT_FOUND');

    const authorized = await assertCanManage(
      ctx,
      game,
      args.adminTokenHash ?? null,
      args.callerPlayerId ?? null,
      args.playerTokenHash ?? null
    );
    if (!authorized) throw new ConvexError('UNAUTHORIZED');

    const now = Date.now();
    const nextTimerProps = resetTimerProps(game.timerProps);

    await ctx.db.patch(game._id, {
      gameStatus: STATUS.Started,
      ...(nextTimerProps !== undefined ? { timerProps: nextTimerProps } : {}),
      updatedAt: now,
    });

    const players = await getActivePlayersByGameId(ctx, args.gameId);
    await Promise.all(
      players.map((player) =>
        ctx.db.patch(player._id, {
          status: STATUS.NotStarted,
          value: 0,
          emoji: null,
          updatedAt: now,
        })
      )
    );
  },
});

export const updateTimer = mutation({
  args: {
    gameId: v.string(),
    timerProps: v.any(),
    adminTokenHash: v.optional(v.string()),
    callerPlayerId: v.optional(v.string()),
    playerTokenHash: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new ConvexError('NOT_FOUND');

    const authorized = await assertCanManage(
      ctx,
      game,
      args.adminTokenHash ?? null,
      args.callerPlayerId ?? null,
      args.playerTokenHash ?? null
    );
    if (!authorized) throw new ConvexError('UNAUTHORIZED');

    const now = Date.now();
    const timerProps = assertTimerInput(args.timerProps);
    const previousTimerProps = pickTimerFields(game.timerProps);
    const previousStartedAt = previousTimerProps.startedAt;
    const previousTotalSeconds = previousTimerProps.totalSeconds;
    const elapsedSeconds = timerProps?.elapsedSeconds;

    if (
      timerProps &&
      typeof timerProps.startedAt === 'number' &&
      typeof elapsedSeconds !== 'number'
    ) {
      if (typeof previousStartedAt !== 'number') {
        throw new ConvexError('INVALID_INPUT');
      }
      timerProps.startedAt = previousStartedAt;
    }

    if (timerProps && typeof elapsedSeconds === 'number') {
      timerProps.startedAt = now - elapsedSeconds * 1000;
      timerProps.pausedAt = null;
      delete timerProps.elapsedSeconds;
    }

    const nextStartedAt = timerProps?.startedAt;
    const nextTotalSeconds = timerProps?.totalSeconds;
    const scheduleChanged =
      typeof nextStartedAt === 'number' &&
      typeof nextTotalSeconds === 'number' &&
      (nextStartedAt !== previousStartedAt ||
        nextTotalSeconds !== previousTotalSeconds);

    await ctx.db.patch(game._id, {
      timerProps,
      updatedAt: now,
    });

    if (scheduleChanged) {
      const deadline = nextStartedAt + nextTotalSeconds * 1000;
      await ctx.scheduler.runAt(
        Math.max(now, deadline),
        internal.games.completeTimer,
        {
          gameId: args.gameId,
          startedAt: nextStartedAt,
          totalSeconds: nextTotalSeconds,
        }
      );
    }

    return null;
  },
});

export const completeTimer = internalMutation({
  args: {
    gameId: v.string(),
    startedAt: v.number(),
    totalSeconds: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) return null;

    const timerProps = pickTimerFields(game.timerProps);
    if (
      timerProps.startedAt !== args.startedAt ||
      timerProps.totalSeconds !== args.totalSeconds
    ) {
      return null;
    }

    const now = Date.now();
    const nextTimerProps = resetTimerProps(game.timerProps);
    await ctx.db.patch(game._id, {
      gameStatus: STATUS.Finished,
      ...(nextTimerProps !== undefined ? { timerProps: nextTimerProps } : {}),
      timerCompletedAt: now,
      updatedAt: now,
    });

    return null;
  },
});

export const setAutoReveal = mutation({
  args: {
    gameId: v.string(),
    autoReveal: v.boolean(),
    adminTokenHash: v.optional(v.string()),
    callerPlayerId: v.optional(v.string()),
    playerTokenHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new ConvexError('NOT_FOUND');

    const authorized = await assertCanManage(
      ctx,
      game,
      args.adminTokenHash ?? null,
      args.callerPlayerId ?? null,
      args.playerTokenHash ?? null
    );
    if (!authorized) throw new ConvexError('UNAUTHORIZED');

    const now = Date.now();
    await ctx.db.patch(game._id, {
      autoReveal: args.autoReveal,
      ...(await getAutoRevealPatch(ctx, {
        ...game,
        autoReveal: args.autoReveal,
      })),
      updatedAt: now,
    });
  },
});

export const removePlayer = mutation({
  args: {
    gameId: v.string(),
    playerId: v.string(),
    adminTokenHash: v.optional(v.string()),
    callerPlayerId: v.optional(v.string()),
    playerTokenHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new ConvexError('NOT_FOUND');

    const authorized = await assertCanManage(
      ctx,
      game,
      args.adminTokenHash ?? null,
      args.callerPlayerId ?? null,
      args.playerTokenHash ?? null
    );
    if (!authorized) throw new ConvexError('UNAUTHORIZED');

    const targets = await getPlayersByGameAndPlayerId(
      ctx,
      args.gameId,
      args.playerId
    );
    if (targets.length === 0) throw new ConvexError('NOT_FOUND');

    // Only the admin (creator) may remove the creator. A member with
    // "manage session" rights cannot evict the owner.
    const isAdmin = Boolean(
      args.adminTokenHash &&
        timingSafeStringEqual(args.adminTokenHash, game.adminTokenHash)
    );
    if (args.playerId === game.createdById && !isAdmin) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const now = Date.now();
    await Promise.all(
      targets.map((target) =>
        ctx.db.patch(target._id, {
          membershipStatus: MEMBERSHIP.Removed,
          status: STATUS.NotStarted,
          value: 0,
          emoji: null,
          updatedAt: now,
        })
      )
    );
    await revokeActiveInvites(ctx, args.gameId, 'player_removed', now);
    await ctx.db.patch(game._id, {
      ...(await getAutoRevealPatch(ctx, game)),
      updatedAt: now,
    });
  },
});

export const deleteGame = mutation({
  args: {
    gameId: v.string(),
    adminTokenHash: v.optional(v.string()),
    // Older open tabs still send these fields; only the admin hash authorizes deletion.
    callerPlayerId: v.optional(v.string()),
    playerTokenHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new ConvexError('NOT_FOUND');

    // Deleting the whole game is owner-only, regardless of the
    // "members can manage session" flag (which covers in-session controls,
    // not destroying the game).
    const isAdmin = Boolean(
      args.adminTokenHash &&
        timingSafeStringEqual(args.adminTokenHash, game.adminTokenHash)
    );
    if (!isAdmin) throw new ConvexError('UNAUTHORIZED');

    await deleteGameData(ctx, game);
  },
});
