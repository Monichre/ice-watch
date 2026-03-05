import { queryGeneric } from "convex/server";
import { v } from "convex/values";
import { normalizePlate } from "./_utils";

export const getByPlate = queryGeneric({
  args: {
    licensePlate: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const plate = normalizePlate(args.licensePlate);
    const rows = await ctx.db
      .query("sightings")
      .withIndex("by_normalizedPlate", (q) => q.eq("normalizedPlate", plate))
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 250, 1), 500));
    return rows;
  },
});

export const listAll = queryGeneric({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const max = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const rows = await ctx.db.query("sightings").withIndex("by_createdAt").order("desc").take(1000);
    const byPlate = new Map<
      string,
      {
        licensePlate: string;
        normalizedPlate: string;
        sightingCount: number;
        lastSeen: number;
        avgCredibility: number;
      }
    >();
    for (const row of rows) {
      const current = byPlate.get(row.normalizedPlate);
      const score = Number.parseFloat(row.credibilityScore);
      if (!current) {
        byPlate.set(row.normalizedPlate, {
          licensePlate: row.licensePlate,
          normalizedPlate: row.normalizedPlate,
          sightingCount: 1,
          lastSeen: row.createdAt,
          avgCredibility: score,
        });
        continue;
      }

      const nextCount = current.sightingCount + 1;
      current.sightingCount = nextCount;
      current.lastSeen = Math.max(current.lastSeen, row.createdAt);
      current.avgCredibility = ((current.avgCredibility * (nextCount - 1)) + score) / nextCount;
    }

    return Array.from(byPlate.values())
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, max);
  },
});
