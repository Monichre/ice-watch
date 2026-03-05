import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getUserVote = query({
  args: { deviceId: v.string(), sightingId: v.id("sightings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("votes")
      .withIndex("by_deviceId_sightingId", (q) =>
        q.eq("deviceId", args.deviceId).eq("sightingId", args.sightingId)
      )
      .first();
  },
});

export const cast = mutation({
  args: {
    deviceId: v.string(),
    sightingId: v.id("sightings"),
    voteType: v.union(v.literal("upvote"), v.literal("downvote"), v.literal("flag")),
  },
  handler: async (ctx, args) => {
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_deviceId_sightingId", (q) =>
        q.eq("deviceId", args.deviceId).eq("sightingId", args.sightingId)
      )
      .first();

    if (existingVote) {
      await ctx.db.patch(existingVote._id, { voteType: args.voteType });
    } else {
      await ctx.db.insert("votes", {
        deviceId: args.deviceId,
        sightingId: args.sightingId,
        voteType: args.voteType,
      });
    }

    // Recalculate votes
    await recalculateSightingVotes(ctx, args.sightingId);
  },
});

export const remove = mutation({
  args: { deviceId: v.string(), sightingId: v.id("sightings") },
  handler: async (ctx, args) => {
    const existingVote = await ctx.db
      .query("votes")
      .withIndex("by_deviceId_sightingId", (q) =>
        q.eq("deviceId", args.deviceId).eq("sightingId", args.sightingId)
      )
      .first();

    if (existingVote) {
      await ctx.db.delete(existingVote._id);
      await recalculateSightingVotes(ctx, args.sightingId);
    }
  },
});

export const getCounts = query({
  args: { sightingId: v.id("sightings") },
  handler: async (ctx, args) => {
    const allVotes = await ctx.db
      .query("votes")
      .withIndex("by_sightingId", (q) => q.eq("sightingId", args.sightingId))
      .collect();

    return {
      upvotes: allVotes.filter((v) => v.voteType === "upvote").length,
      downvotes: allVotes.filter((v) => v.voteType === "downvote").length,
      flagCount: allVotes.filter((v) => v.voteType === "flag").length,
    };
  },
});

async function recalculateSightingVotes(ctx: any, sightingId: any) {
  const allVotes = await ctx.db
    .query("votes")
    .withIndex("by_sightingId", (q: any) => q.eq("sightingId", sightingId))
    .collect();

  const upvotes = allVotes.filter((v: any) => v.voteType === "upvote").length;
  const downvotes = allVotes.filter((v: any) => v.voteType === "downvote").length;
  const flagCount = allVotes.filter((v: any) => v.voteType === "flag").length;

  const totalVotes = upvotes + downvotes;
  const credibilityScore = totalVotes > 0 ? (upvotes / totalVotes) * 100 : 0;
  const isHidden = totalVotes >= 5 && credibilityScore < 40;

  await ctx.db.patch(sightingId, {
    upvotes,
    downvotes,
    flagCount,
    credibilityScore,
    isHidden,
  });
}
