import { mutationGeneric, queryGeneric } from "convex/server";
import type { GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import { assertRateLimit, calculateCredibility, nextCounterValue, shouldHideSighting } from "./_utils";

async function refreshSightingVoteState(ctx: GenericMutationCtx<any>, sightingId: number) {
  const allVotes = await ctx.db
    .query("votes")
    .withIndex("by_sightingId", (q) => q.eq("sightingId", sightingId))
    .collect();

  const upvotes = allVotes.filter((vote) => vote.voteType === "upvote").length;
  const downvotes = allVotes.filter((vote) => vote.voteType === "downvote").length;
  const flagCount = allVotes.filter((vote) => vote.voteType === "flag").length;

  const credibility = calculateCredibility(upvotes, downvotes);
  const isHidden = shouldHideSighting(upvotes, downvotes, credibility);

  const sighting = await ctx.db
    .query("sightings")
    .withIndex("by_id", (q) => q.eq("id", sightingId))
    .unique();

  if (!sighting) {
    throw new Error(`Sighting ${sightingId} not found`);
  }

  await ctx.db.patch(sighting._id, {
    upvotes,
    downvotes,
    flagCount,
    credibilityScore: credibility.toFixed(2),
    isHidden,
    updatedAt: Date.now(),
  });

  return { upvotes, downvotes, flagCount };
}

export const getUserVote = queryGeneric({
  args: {
    deviceId: v.string(),
    sightingId: v.number(),
  },
  handler: async (ctx, args) => {
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_sightingId", (q) => q.eq("sightingId", args.sightingId))
      .collect();
    return votes.find((vote) => vote.deviceId === args.deviceId) ?? null;
  },
});

export const getCounts = queryGeneric({
  args: { sightingId: v.number() },
  handler: async (ctx, args) => {
    const allVotes = await ctx.db
      .query("votes")
      .withIndex("by_sightingId", (q) => q.eq("sightingId", args.sightingId))
      .collect();

    return {
      upvotes: allVotes.filter((vote) => vote.voteType === "upvote").length,
      downvotes: allVotes.filter((vote) => vote.voteType === "downvote").length,
      flagCount: allVotes.filter((vote) => vote.voteType === "flag").length,
    };
  },
});

export const cast = mutationGeneric({
  args: {
    deviceId: v.string(),
    sightingId: v.number(),
    voteType: v.union(v.literal("upvote"), v.literal("downvote"), v.literal("flag")),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    await assertRateLimit(ctx, `vote:${args.deviceId}`, 40, 60_000, args.nowMs);
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_sightingId", (q) => q.eq("sightingId", args.sightingId))
      .collect();
    const existing = votes.find((vote) => vote.deviceId === args.deviceId) ?? null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        voteType: args.voteType,
        updatedAt: args.nowMs,
      });
    } else {
      const id = await nextCounterValue(ctx, "votes");
      await ctx.db.insert("votes", {
        id,
        sightingId: args.sightingId,
        deviceId: args.deviceId,
        voteType: args.voteType,
        createdAt: args.nowMs,
        updatedAt: args.nowMs,
      });
    }

    return await refreshSightingVoteState(ctx, args.sightingId);
  },
});

export const remove = mutationGeneric({
  args: {
    deviceId: v.string(),
    sightingId: v.number(),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    await assertRateLimit(ctx, `vote-remove:${args.deviceId}`, 40, 60_000, args.nowMs);
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_sightingId", (q) => q.eq("sightingId", args.sightingId))
      .collect();
    const existing = votes.find((vote) => vote.deviceId === args.deviceId) ?? null;

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return await refreshSightingVoteState(ctx, args.sightingId);
  },
});
