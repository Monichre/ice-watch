import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertRateLimit, haversineKm, nearbyGeoBuckets, normalizePlate } from "./_utils";

export const nearby = queryGeneric({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    radiusKm: v.optional(v.number()),
    sinceMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const radiusKm = Math.min(Math.max(args.radiusKm ?? 5, 0.1), 50);
    const buckets = nearbyGeoBuckets(args.latitude, args.longitude, radiusKm);
    const rowsByBucket = await Promise.all(
      buckets.map((bucket) =>
        ctx.db
          .query("sightings")
          .withIndex("by_geoBucket_createdAt", (q) => q.eq("geoBucket", bucket))
          .order("desc")
          .take(250),
      ),
    );

    const deduped = new Map<string, (typeof rowsByBucket)[number][number]>();
    for (const group of rowsByBucket) {
      for (const row of group) {
        deduped.set(String(row._id), row);
      }
    }

    const filtered = Array.from(deduped.values())
      .filter((row) => !row.isHidden)
      .filter((row) => (args.sinceMs ? row.createdAt > args.sinceMs : true))
      .map((row) => ({
        ...row,
        distanceKm: haversineKm(
          args.latitude,
          args.longitude,
          Number.parseFloat(row.latitude),
          Number.parseFloat(row.longitude),
        ),
      }))
      .filter((row) => row.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return filtered;
  },
});

export const upsertWatch = mutationGeneric({
  args: {
    deviceId: v.string(),
    licensePlate: v.string(),
    watch: v.boolean(),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    await assertRateLimit(ctx, `watch:${args.deviceId}`, 120, 60_000, args.nowMs);
    const normalizedPlate = normalizePlate(args.licensePlate);
    const existingRows = await ctx.db
      .query("watchSubscriptions")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();
    const existing = existingRows.find((row) => row.normalizedPlate === normalizedPlate);

    if (args.watch) {
      if (existing) {
        await ctx.db.patch(existing._id, { updatedAt: args.nowMs });
      } else {
        await ctx.db.insert("watchSubscriptions", {
          deviceId: args.deviceId,
          normalizedPlate,
          createdAt: args.nowMs,
          updatedAt: args.nowMs,
        });
      }
      return { watch: true, normalizedPlate };
    }

    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { watch: false, normalizedPlate };
  },
});

export const watchedPlates = queryGeneric({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("watchSubscriptions")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();
  },
});
