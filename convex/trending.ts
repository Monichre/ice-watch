import { queryGeneric } from "convex/server";
import { v } from "convex/values";

export const plates = queryGeneric({
  args: {
    nowMs: v.number(),
    lookbackHours: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lookbackHours = Math.min(Math.max(args.lookbackHours ?? 24, 1), 168);
    const cutoff = args.nowMs - lookbackHours * 60 * 60 * 1000;
    const max = Math.min(Math.max(args.limit ?? 20, 1), 100);

    const rows = await ctx.db.query("sightings").withIndex("by_createdAt").order("desc").take(1500);
    const recent = rows.filter((row) => row.createdAt >= cutoff);
    const byPlate = new Map<
      string,
      {
        plate: string;
        count: number;
        lastSeen: number;
        agencyType: string | null;
        avgCredibility: number;
      }
    >();

    for (const row of recent) {
      const score = Number.parseFloat(row.credibilityScore);
      const item = byPlate.get(row.normalizedPlate);
      if (!item) {
        byPlate.set(row.normalizedPlate, {
          plate: row.licensePlate,
          count: 1,
          lastSeen: row.createdAt,
          agencyType: row.agencyType ?? null,
          avgCredibility: score,
        });
        continue;
      }

      const nextCount = item.count + 1;
      item.count = nextCount;
      item.lastSeen = Math.max(item.lastSeen, row.createdAt);
      item.agencyType = row.agencyType ?? item.agencyType;
      item.avgCredibility = ((item.avgCredibility * (nextCount - 1)) + score) / nextCount;
    }

    return Array.from(byPlate.values())
      .sort((a, b) => (b.count - a.count) || (b.lastSeen - a.lastSeen))
      .slice(0, max);
  },
});
