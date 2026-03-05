import { queryGeneric } from "convex/server";
import { v } from "convex/values";

export const since = queryGeneric({
  args: {
    sinceMs: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const max = Math.min(Math.max(args.limit ?? 200, 1), 1000);
    const rows = await ctx.db.query("sightings").withIndex("by_createdAt").order("desc").take(max);
    return rows.filter((row) => row.createdAt > args.sinceMs && !row.isHidden);
  },
});
