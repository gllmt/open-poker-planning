import { RETENTION_MS } from '../lib/retention';
import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { deleteGameData } from './gameDeletion';

const BATCH_SIZE = 10;

export const purgeInactiveGames = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const games = await ctx.db
      .query('games')
      .withIndex('by_updatedAt', (q) =>
        q.lte('updatedAt', Date.now() - RETENTION_MS)
      )
      .take(BATCH_SIZE);

    // Deletion and the inactivity check share one transaction. Concurrent
    // activity causes a retry against the latest updatedAt.
    for (const game of games) await deleteGameData(ctx, game);

    if (games.length === BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        0,
        internal.retention.purgeInactiveGames,
        {}
      );
    }
    return games.length;
  },
});
