import type { Doc } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

export async function deleteGameData(ctx: MutationCtx, game: Doc<'games'>) {
  // Application writes bound each game to 50 players and 100 invitations.
  const [players, invites] = await Promise.all([
    ctx.db
      .query('players')
      .withIndex('by_gameId', (q) => q.eq('gameId', game.gameId))
      .collect(),
    ctx.db
      .query('gameInvites')
      .withIndex('by_gameId', (q) => q.eq('gameId', game.gameId))
      .collect(),
  ]);
  await Promise.all([
    ...players.map((player) => ctx.db.delete(player._id)),
    ...invites.map((invite) => ctx.db.delete(invite._id)),
  ]);
  await ctx.db.delete(game._id);
}
