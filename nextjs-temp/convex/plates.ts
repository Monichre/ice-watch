import { v } from "convex/values";
import { query } from "./_generated/server";

export const getByPlate = query({
  args: { licensePlate: v.string() },
  handler: async (ctx, args) => {
    const normalizedPlate = args.licensePlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return await ctx.db
      .query("sightings")
      .withIndex("by_licensePlate", (q) => q.eq("licensePlate", normalizedPlate))
      .order("desc")
      .collect();
  },
});

export const listAll = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const allSightings = await ctx.db.query("sightings").order("desc").take(limit * 10);
    
    const plateMap = new Map();
    for (const sighting of allSightings) {
      if (!plateMap.has(sighting.licensePlate)) {
        plateMap.set(sighting.licensePlate, {
          licensePlate: sighting.licensePlate,
          sightingCount: 1,
          lastSeen: sighting._creationTime,
          totalCredibility: sighting.credibilityScore,
        });
      } else {
        const entry = plateMap.get(sighting.licensePlate);
        entry.sightingCount += 1;
        entry.totalCredibility += sighting.credibilityScore;
        entry.lastSeen = Math.max(entry.lastSeen, sighting._creationTime);
      }
    }

    return Array.from(plateMap.values())
      .map((entry) => ({
        ...entry,
        avgCredibility: entry.totalCredibility / entry.sightingCount,
      }))
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, limit);
  },
});
