import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  games: defineTable({
    gameId: v.string(),
    name: v.string(),
    gameType: v.string(),
    cards: v.array(v.any()),
    createdBy: v.string(),
    createdById: v.string(),
    isAllowMembersToManageSession: v.boolean(),
    storyName: v.union(v.string(), v.null()),
    autoReveal: v.boolean(),
    gameStatus: v.string(),
    timerProps: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
    joinTokenHash: v.string(),
    adminTokenHash: v.string(),
  }).index('by_gameId', ['gameId']),
  players: defineTable({
    playerId: v.string(),
    gameId: v.string(),
    name: v.string(),
    status: v.string(),
    value: v.union(v.number(), v.null()),
    emoji: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
    playerTokenHash: v.string(),
  })
    .index('by_gameId', ['gameId'])
    .index('by_gameId_playerId', ['gameId', 'playerId']),
});
