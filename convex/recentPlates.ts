import { queryGeneric } from "convex/server";
import { v } from "convex/values";

export const list = queryGeneric({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const max = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const rows = await ctx.db.query("sightings").withIndex("by_createdAt").order("desc").take(1000);
    const seen = new Set<string>();
    const result: Array<{
      licensePlate: string;
      normalizedPlate: string;
      lastSeen: number;
      count: number;
    }> = [];

    for (const row of rows) {
      if (seen.has(row.normalizedPlate)) continue;
      seen.add(row.normalizedPlate);
      const count = rows.filter((item) => item.normalizedPlate === row.normalizedPlate).length;
      result.push({
        licensePlate: row.licensePlate,
        normalizedPlate: row.normalizedPlate,
        lastSeen: row.createdAt,
        count,
      });
      if (result.length >= max) break;
    }
    return result;
  },
});
