import { v } from 'convex/values';

import type { Game } from '../types/game';
import type { Player } from '../types/player';
import { Status } from '../types/status';
import type { Doc } from './_generated/dataModel';
import { type DatabaseReader, mutation, query } from './_generated/server';

const STATUS = Status;

type GameDoc = Doc<'games'>;
type PlayerDoc = Doc<'players'>;

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

type DbReaderCtx = { db: DatabaseReader };

async function getGameByGameId(ctx: DbReaderCtx, gameId: string) {
  const results = (await ctx.db
    .query('games')
    .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
    .collect()) as GameDoc[];
  return results[0] ?? null;
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
  return Boolean(caller && caller.playerTokenHash === playerTokenHash);
}

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
    if (args.joinTokenHash && args.joinTokenHash === game.joinTokenHash) {
      authorized = true;
    }

    if (!authorized && args.playerId && args.playerTokenHash) {
      const player = await getPlayerByGameAndPlayerId(
        ctx,
        args.gameId,
        args.playerId
      );
      if (player && player.playerTokenHash === args.playerTokenHash) {
        authorized = true;
      }
    }

    if (!authorized) throw new Error('UNAUTHORIZED');

    const players = (await ctx.db
      .query('players')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .collect()) as PlayerDoc[];

    players.sort((a, b) => a.createdAt - b.createdAt);

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
      value: 0,
      emoji: null,
      createdAt: now,
      updatedAt: now,
      playerTokenHash: args.playerTokenHash,
    });
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
    if (args.joinTokenHash !== game.joinTokenHash) {
      throw new Error('INVALID_INVITE');
    }

    const now = Date.now();
    await ctx.db.insert('players', {
      playerId: args.playerId,
      gameId: args.gameId,
      name: args.playerName,
      status: STATUS.NotStarted,
      value: 0,
      emoji: null,
      createdAt: now,
      updatedAt: now,
      playerTokenHash: args.playerTokenHash,
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
    if (!player || player.playerTokenHash !== args.playerTokenHash) {
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
      const players = (await ctx.db
        .query('players')
        .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
        .collect()) as PlayerDoc[];
      const allFinished =
        players.length > 0 &&
        players.every((p) =>
          p.playerId === args.playerId ? true : p.status === STATUS.Finished
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

    const players = (await ctx.db
      .query('players')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .collect()) as PlayerDoc[];

    await Promise.all(
      players.map((player) =>
        ctx.db.patch(player._id, {
          status: STATUS.NotStarted,
          value: 0,
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
    if (!player || player.playerTokenHash !== args.playerTokenHash) {
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
    await ctx.db.delete(target._id);
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

    const players = (await ctx.db
      .query('players')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .collect()) as PlayerDoc[];

    await Promise.all(players.map((player) => ctx.db.delete(player._id)));
    await ctx.db.delete(game._id);
  },
});
