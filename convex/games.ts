import { v } from 'convex/values';

import type { Game } from '../types/game';
import type { Player } from '../types/player';
import { Status } from '../types/status';
import type { Doc } from './_generated/dataModel';
import {
  type DatabaseReader,
  type MutationCtx,
  mutation,
  query,
} from './_generated/server';

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

const resetTimerProps = (timerProps: unknown) => {
  if (timerProps === undefined) return undefined;
  if (timerProps === null) return null;
  if (typeof timerProps !== 'object') return null;
  return {
    ...(timerProps as Record<string, unknown>),
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

async function getPlayerByGameAndPlayerId(
  ctx: DbReaderCtx,
  gameId: string,
  playerId: string
) {
  const results = (await ctx.db
    .query('players')
    .withIndex('by_gameId_playerId', (q) =>
      q.eq('gameId', gameId).eq('playerId', playerId)
    )
    .collect()) as PlayerDoc[];
  return results[0] ?? null;
}

async function getPlayerByGameAndPlayerTokenHash(
  ctx: DbReaderCtx,
  gameId: string,
  playerTokenHash: string
) {
  const results = (await ctx.db
    .query('players')
    .withIndex('by_gameId_playerTokenHash', (q) =>
      q.eq('gameId', gameId).eq('playerTokenHash', playerTokenHash)
    )
    .collect()) as PlayerDoc[];
  return results[0] ?? null;
}

async function getInvitesByGameId(ctx: DbReaderCtx, gameId: string) {
  return (await ctx.db
    .query('gameInvites')
    .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
    .collect()) as GameInviteDoc[];
}

async function hasValidInviteToken(
  ctx: DbReaderCtx,
  game: GameDoc,
  tokenHash: string
) {
  const invites = await getInvitesByGameId(ctx, game.gameId);
  if (invites.length === 0) {
    return tokenHash === game.joinTokenHash;
  }

  return invites.some(
    (invite) => invite.tokenHash === tokenHash && invite.revokedAt === null
  );
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
  if (adminTokenHash && adminTokenHash === game.adminTokenHash) return true;
  if (!game.isAllowMembersToManageSession) return false;
  if (!callerPlayerId || !playerTokenHash) return false;

  const caller = await getPlayerByGameAndPlayerId(
    ctx,
    game.gameId,
    callerPlayerId
  );

  return Boolean(
    caller &&
      isActivePlayer(caller) &&
      caller.playerTokenHash === playerTokenHash
  );
}

async function assertCanCreateInvite(
  ctx: DbReaderCtx,
  game: GameDoc,
  playerId: string,
  playerTokenHash: string,
  adminTokenHash?: string | null
) {
  if (adminTokenHash && adminTokenHash === game.adminTokenHash) return true;

  const caller = await getPlayerByGameAndPlayerId(ctx, game.gameId, playerId);

  return Boolean(
    caller &&
      isActivePlayer(caller) &&
      caller.playerTokenHash === playerTokenHash
  );
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

  return {
    type: 'ready',
    currentPlayerId: viewer.playerId,
    game: sanitizeGame(game),
    players: players.map(sanitizePlayer),
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

export const getGameState = query({
  args: {
    gameId: v.string(),
    joinTokenHash: v.optional(v.string()),
    playerId: v.optional(v.string()),
    playerTokenHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new Error('NOT_FOUND');

    let authorized = false;

    if (args.joinTokenHash) {
      authorized = await hasValidInviteToken(ctx, game, args.joinTokenHash);
    }

    if (!authorized && args.playerId && args.playerTokenHash) {
      const player = await getPlayerByGameAndPlayerId(
        ctx,
        args.gameId,
        args.playerId
      );

      if (
        player &&
        isActivePlayer(player) &&
        player.playerTokenHash === args.playerTokenHash
      ) {
        authorized = true;
      }
    }

    if (!authorized) throw new Error('UNAUTHORIZED');

    const players = await getActivePlayersByGameId(ctx, args.gameId);

    return {
      game: sanitizeGame(game),
      players: players.map(sanitizePlayer),
    };
  },
});

export const createGame = mutation({
  args: {
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
    const now = Date.now();

    await ctx.db.insert('games', {
      gameId: args.gameId,
      name: args.name,
      gameType: args.gameType,
      cards: args.cards,
      createdBy: args.createdBy,
      createdById: args.createdById,
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
      playerId: args.createdById,
      gameId: args.gameId,
      name: args.createdBy,
      status: STATUS.NotStarted,
      membershipStatus: MEMBERSHIP.Active,
      value: 0,
      emoji: null,
      createdAt: now,
      updatedAt: now,
      playerTokenHash: args.playerTokenHash,
    });

    await ctx.db.insert('gameInvites', {
      gameId: args.gameId,
      tokenHash: args.joinTokenHash,
      createdByPlayerId: args.createdById,
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
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new Error('NOT_FOUND');

    const authorized = await assertCanCreateInvite(
      ctx,
      game,
      args.createdByPlayerId,
      args.playerTokenHash,
      args.adminTokenHash ?? null
    );
    if (!authorized) throw new Error('UNAUTHORIZED');

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
    gameId: v.string(),
    playerId: v.string(),
    playerName: v.string(),
    playerTokenHash: v.string(),
    joinTokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new Error('NOT_FOUND');

    const hasValidInvite = await hasValidInviteToken(
      ctx,
      game,
      args.joinTokenHash
    );
    if (!hasValidInvite) {
      throw new Error('INVALID_INVITE');
    }

    const now = Date.now();
    await ctx.db.insert('players', {
      playerId: args.playerId,
      gameId: args.gameId,
      name: args.playerName,
      status: STATUS.NotStarted,
      membershipStatus: MEMBERSHIP.Active,
      value: 0,
      emoji: null,
      createdAt: now,
      updatedAt: now,
      playerTokenHash: args.playerTokenHash,
    });

    await ctx.db.patch(game._id, { updatedAt: now });
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
    if (!game) throw new Error('NOT_FOUND');

    const player = await getPlayerByGameAndPlayerId(
      ctx,
      args.gameId,
      args.playerId
    );
    if (
      !player ||
      !isActivePlayer(player) ||
      player.playerTokenHash !== args.playerTokenHash
    ) {
      throw new Error('UNAUTHORIZED');
    }

    const now = Date.now();
    await ctx.db.patch(player._id, {
      membershipStatus: MEMBERSHIP.Left,
      status: STATUS.NotStarted,
      value: 0,
      emoji: null,
      updatedAt: now,
    });
    await ctx.db.patch(game._id, { updatedAt: now });
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
    if (!game) throw new Error('NOT_FOUND');

    const player = await getPlayerByGameAndPlayerId(
      ctx,
      args.gameId,
      args.playerId
    );
    if (
      !player ||
      !isActivePlayer(player) ||
      player.playerTokenHash !== args.playerTokenHash
    ) {
      throw new Error('UNAUTHORIZED');
    }

    if (game.gameStatus === STATUS.Finished) {
      throw new Error('GAME_FINISHED');
    }

    const now = Date.now();
    await ctx.db.patch(player._id, {
      value: args.value,
      emoji: args.emoji ?? null,
      status: STATUS.Finished,
      updatedAt: now,
    });

    let nextStatus: Status = STATUS.InProgress;
    if (game.autoReveal) {
      const players = await getActivePlayersByGameId(ctx, args.gameId);
      const allFinished =
        players.length > 0 &&
        players.every((entry) =>
          entry.playerId === args.playerId
            ? true
            : entry.status === STATUS.Finished
        );
      if (allFinished) nextStatus = STATUS.Finished;
    }

    const nextTimerProps =
      game.autoReveal && nextStatus === STATUS.Finished
        ? resetTimerProps(game.timerProps)
        : undefined;

    await ctx.db.patch(game._id, {
      gameStatus: nextStatus,
      ...(nextTimerProps !== undefined ? { timerProps: nextTimerProps } : {}),
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
    if (!game) throw new Error('NOT_FOUND');

    const authorized = await assertCanManage(
      ctx,
      game,
      args.adminTokenHash ?? null,
      args.callerPlayerId ?? null,
      args.playerTokenHash ?? null
    );
    if (!authorized) throw new Error('UNAUTHORIZED');

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
    if (!game) throw new Error('NOT_FOUND');

    const authorized = await assertCanManage(
      ctx,
      game,
      args.adminTokenHash ?? null,
      args.callerPlayerId ?? null,
      args.playerTokenHash ?? null
    );
    if (!authorized) throw new Error('UNAUTHORIZED');

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

export const updateStory = mutation({
  args: {
    gameId: v.string(),
    callerPlayerId: v.string(),
    playerTokenHash: v.string(),
    storyName: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new Error('NOT_FOUND');

    const player = await getPlayerByGameAndPlayerId(
      ctx,
      args.gameId,
      args.callerPlayerId
    );
    if (
      !player ||
      !isActivePlayer(player) ||
      player.playerTokenHash !== args.playerTokenHash
    ) {
      throw new Error('UNAUTHORIZED');
    }

    const now = Date.now();
    await ctx.db.patch(game._id, {
      storyName: args.storyName || null,
      updatedAt: now,
    });
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
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new Error('NOT_FOUND');

    const authorized = await assertCanManage(
      ctx,
      game,
      args.adminTokenHash ?? null,
      args.callerPlayerId ?? null,
      args.playerTokenHash ?? null
    );
    if (!authorized) throw new Error('UNAUTHORIZED');

    const now = Date.now();
    await ctx.db.patch(game._id, {
      timerProps: args.timerProps ?? null,
      updatedAt: now,
    });
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
    if (!game) throw new Error('NOT_FOUND');

    const authorized = await assertCanManage(
      ctx,
      game,
      args.adminTokenHash ?? null,
      args.callerPlayerId ?? null,
      args.playerTokenHash ?? null
    );
    if (!authorized) throw new Error('UNAUTHORIZED');

    const now = Date.now();
    await ctx.db.patch(game._id, {
      autoReveal: args.autoReveal,
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
    if (!game) throw new Error('NOT_FOUND');

    const authorized = await assertCanManage(
      ctx,
      game,
      args.adminTokenHash ?? null,
      args.callerPlayerId ?? null,
      args.playerTokenHash ?? null
    );
    if (!authorized) throw new Error('UNAUTHORIZED');

    const target = await getPlayerByGameAndPlayerId(
      ctx,
      args.gameId,
      args.playerId
    );
    if (!target) throw new Error('NOT_FOUND');

    const now = Date.now();
    await ctx.db.patch(target._id, {
      membershipStatus: MEMBERSHIP.Removed,
      status: STATUS.NotStarted,
      value: 0,
      emoji: null,
      updatedAt: now,
    });
    await revokeActiveInvites(ctx, args.gameId, 'player_removed', now);
    await ctx.db.patch(game._id, { updatedAt: now });
  },
});

export const deleteGame = mutation({
  args: {
    gameId: v.string(),
    adminTokenHash: v.optional(v.string()),
    callerPlayerId: v.optional(v.string()),
    playerTokenHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const game = await getGameByGameId(ctx, args.gameId);
    if (!game) throw new Error('NOT_FOUND');

    const authorized = await assertCanManage(
      ctx,
      game,
      args.adminTokenHash ?? null,
      args.callerPlayerId ?? null,
      args.playerTokenHash ?? null
    );
    if (!authorized) throw new Error('UNAUTHORIZED');

    const players = await getPlayersByGameId(ctx, args.gameId);
    const invites = await getInvitesByGameId(ctx, args.gameId);

    await Promise.all(players.map((player) => ctx.db.delete(player._id)));
    await Promise.all(invites.map((invite) => ctx.db.delete(invite._id)));
    await ctx.db.delete(game._id);
  },
});
