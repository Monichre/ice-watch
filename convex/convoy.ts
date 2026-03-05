import { queryGeneric } from "convex/server";
import { v } from "convex/values";
import { haversineKm } from "./_utils";

export const detect = queryGeneric({
  args: {
    nowMs: v.number(),
    radiusKm: v.optional(v.number()),
    windowMinutes: v.optional(v.number()),
    minVehicles: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const radiusKm = Math.min(Math.max(args.radiusKm ?? 0.5, 0.1), 10);
    const windowMinutes = Math.min(Math.max(args.windowMinutes ?? 15, 1), 120);
    const minVehicles = Math.min(Math.max(args.minVehicles ?? 2, 2), 12);
    const cutoff = args.nowMs - windowMinutes * 60 * 1000;

    const rows = await ctx.db.query("sightings").withIndex("by_createdAt").order("desc").take(1000);
    const recent = rows.filter((row) => !row.isHidden && row.createdAt >= cutoff);
    if (recent.length < minVehicles) return [];

    const used = new Set<string>();
    const convoys: Array<{
      centerLat: number;
      centerLon: number;
      vehicleCount: number;
      plates: string[];
      agencies: string[];
      firstSeen: number;
      lastSeen: number;
    }> = [];

    for (let i = 0; i < recent.length; i += 1) {
      const seed = recent[i];
      const seedKey = String(seed._id);
      if (used.has(seedKey)) continue;

      const seedLat = Number.parseFloat(seed.latitude);
      const seedLon = Number.parseFloat(seed.longitude);
      const group = [seed];
      used.add(seedKey);

      for (let j = i + 1; j < recent.length; j += 1) {
        const item = recent[j];
        const itemKey = String(item._id);
        if (used.has(itemKey)) continue;
        const itemLat = Number.parseFloat(item.latitude);
        const itemLon = Number.parseFloat(item.longitude);
        if (haversineKm(seedLat, seedLon, itemLat, itemLon) <= radiusKm) {
          group.push(item);
          used.add(itemKey);
        }
      }

      if (group.length >= minVehicles) {
        const lats = group.map((item) => Number.parseFloat(item.latitude));
        const lons = group.map((item) => Number.parseFloat(item.longitude));
        const plates = Array.from(new Set(group.map((item) => item.licensePlate)));
        const agencies = Array.from(
          new Set(group.map((item) => item.agencyType).filter((value): value is string => Boolean(value))),
        );
        const timestamps = group.map((item) => item.createdAt);
        convoys.push({
          centerLat: lats.reduce((acc, value) => acc + value, 0) / lats.length,
          centerLon: lons.reduce((acc, value) => acc + value, 0) / lons.length,
          vehicleCount: group.length,
          plates,
          agencies,
          firstSeen: Math.min(...timestamps),
          lastSeen: Math.max(...timestamps),
        });
      }
    }

    return convoys.sort((a, b) => b.vehicleCount - a.vehicleCount);
  },
});
