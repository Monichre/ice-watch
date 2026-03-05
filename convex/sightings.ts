import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import {
  assertRateLimit,
  calculateCredibility,
  haversineKm,
  nearbyGeoBuckets,
  nextCounterValue,
  normalizePlate,
  shouldHideSighting,
  toGeoBucket,
} from "./_utils";

export const list = queryGeneric({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    minCredibility: v.optional(v.number()),
    hideHidden: v.optional(v.boolean()),
    sinceMs: v.optional(v.number()),
    normalizedPlate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("sightings").withIndex("by_createdAt").order("desc").collect();

    let filtered = rows;
    if (args.hideHidden) {
      filtered = filtered.filter((s) => !s.isHidden);
    }
    if (args.minCredibility !== undefined) {
      filtered = filtered.filter((s) => parseFloat(s.credibilityScore) >= args.minCredibility!);
    }
    if (args.sinceMs !== undefined) {
      filtered = filtered.filter((s) => s.createdAt > args.sinceMs!);
    }
    if (args.normalizedPlate) {
      const plate = normalizePlate(args.normalizedPlate);
      filtered = filtered.filter((s) => s.normalizedPlate.includes(plate));
    }

    const start = Math.max(args.offset ?? 0, 0);
    const end = args.limit ? start + Math.max(args.limit, 0) : undefined;
    return filtered.slice(start, end);
  },
});

export const getById = queryGeneric({
  args: { id: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sightings")
      .withIndex("by_id", (q) => q.eq("id", args.id))
      .unique();
  },
});

export const create = mutationGeneric({
  args: {
    licensePlate: v.string(),
    vehicleType: v.optional(v.union(v.string(), v.null())),
    photoUrl: v.string(),
    latitude: v.string(),
    longitude: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    locationAccuracy: v.optional(v.union(v.string(), v.null())),
    locationAddress: v.optional(v.union(v.string(), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
    photoMetadata: v.optional(v.union(v.string(), v.null())),
    deviceId: v.optional(v.union(v.string(), v.null())),
    agencyType: v.optional(v.union(v.string(), v.null())),
    agencyMarkings: v.optional(v.union(v.string(), v.null())),
    vehicleMake: v.optional(v.union(v.string(), v.null())),
    vehicleModel: v.optional(v.union(v.string(), v.null())),
    vehicleColor: v.optional(v.union(v.string(), v.null())),
    badgeNumber: v.optional(v.union(v.string(), v.null())),
    uniformDescription: v.optional(v.union(v.string(), v.null())),
    aiConfidence: v.optional(v.union(v.string(), v.null())),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.nowMs ?? Date.now();
    if (args.deviceId) {
      await assertRateLimit(ctx, `sighting-create:${args.deviceId}`, 20, 60_000, now);
    }
    const id = await nextCounterValue(ctx, "sightings");
    const lat = parseFloat(args.latitude);
    const lng = parseFloat(args.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("Invalid latitude/longitude. Coordinates must be finite numbers.");
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error("Invalid latitude/longitude range.");
    }
    const normalizedPlate = normalizePlate(args.licensePlate);

    const docId = await ctx.db.insert("sightings", {
      id,
      licensePlate: normalizedPlate,
      normalizedPlate,
      vehicleType: args.vehicleType ?? null,
      photoUrl: args.photoUrl,
      latitude: args.latitude,
      longitude: args.longitude,
      geoBucket: toGeoBucket(lat, lng),
      locationAccuracy: args.locationAccuracy ?? null,
      locationAddress: args.locationAddress ?? null,
      notes: args.notes ?? null,
      photoMetadata: args.photoMetadata ?? null,
      deviceId: args.deviceId ?? null,
      imageStorageId: args.imageStorageId,
      agencyType: args.agencyType ?? null,
      agencyMarkings: args.agencyMarkings ?? null,
      vehicleMake: args.vehicleMake ?? null,
      vehicleModel: args.vehicleModel ?? null,
      vehicleColor: args.vehicleColor ?? null,
      badgeNumber: args.badgeNumber ?? null,
      uniformDescription: args.uniformDescription ?? null,
      aiConfidence: args.aiConfidence ?? null,
      upvotes: 0,
      downvotes: 0,
      flagCount: 0,
      credibilityScore: "0",
      isHidden: false,
      createdAt: now,
      updatedAt: now,
    });

    const row = await ctx.db.get(docId);
    return { id, row };
  },
});

export const updateVotes = mutationGeneric({
  args: {
    sightingId: v.number(),
    upvotes: v.number(),
    downvotes: v.number(),
    flagCount: v.number(),
  },
  handler: async (ctx, args) => {
    const sighting = await ctx.db
      .query("sightings")
      .withIndex("by_id", (q) => q.eq("id", args.sightingId))
      .unique();

    if (!sighting) {
      throw new Error(`Sighting ${args.sightingId} not found`);
    }

    const credibility = calculateCredibility(args.upvotes, args.downvotes);
    const isHidden = shouldHideSighting(args.upvotes, args.downvotes, credibility);

    await ctx.db.patch(sighting._id, {
      upvotes: args.upvotes,
      downvotes: args.downvotes,
      flagCount: args.flagCount,
      credibilityScore: credibility.toFixed(2),
      isHidden,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const searchByLicensePlate = queryGeneric({
  args: { licensePlate: v.string() },
  handler: async (ctx, args) => {
    const needle = normalizePlate(args.licensePlate);
    const rows = await ctx.db.query("sightings").withIndex("by_createdAt").order("desc").collect();
    return rows.filter((s) => s.normalizedPlate.includes(needle));
  },
});

export const nearby = queryGeneric({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    radiusKm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const radiusKm = args.radiusKm ?? 10;
    const buckets = nearbyGeoBuckets(args.latitude, args.longitude, radiusKm);
    const bucketRows = await Promise.all(
      buckets.map((bucket) =>
        ctx.db
          .query("sightings")
          .withIndex("by_geoBucket_createdAt", (q) => q.eq("geoBucket", bucket))
          .order("desc")
          .take(200),
      ),
    );
    const dedupedMap = new Map<string, (typeof bucketRows)[number][number]>();
    for (const rowList of bucketRows) {
      for (const row of rowList) {
        dedupedMap.set(String(row._id), row);
      }
    }
    const rows = Array.from(dedupedMap.values());

    const mapped = rows
      .map((s) => {
        const dist = haversineKm(args.latitude, args.longitude, parseFloat(s.latitude), parseFloat(s.longitude));
        return {
          id: s.id,
          licensePlate: s.licensePlate,
          vehicleType: s.vehicleType,
          photoUrl: s.photoUrl,
          latitude: s.latitude,
          longitude: s.longitude,
          locationAddress: s.locationAddress,
          upvotes: s.upvotes,
          downvotes: s.downvotes,
          credibilityScore: s.credibilityScore,
          createdAt: s.createdAt,
          distance: dist,
        };
      })
      .filter((s) => s.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    return mapped;
  },
});

export const getAllTrackedPlates = queryGeneric({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const rows = await ctx.db.query("sightings").withIndex("by_createdAt").order("desc").collect();

    const grouped = new Map<
      string,
      { licensePlate: string; sightingCount: number; lastSeen: number; credibilityTotal: number }
    >();

    for (const s of rows) {
      const existing = grouped.get(s.licensePlate);
      if (!existing) {
        grouped.set(s.licensePlate, {
          licensePlate: s.licensePlate,
          sightingCount: 1,
          lastSeen: s.createdAt,
          credibilityTotal: parseFloat(s.credibilityScore),
        });
        continue;
      }

      existing.sightingCount += 1;
      existing.credibilityTotal += parseFloat(s.credibilityScore);
      if (s.createdAt > existing.lastSeen) {
        existing.lastSeen = s.createdAt;
      }
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, limit)
      .map((r) => ({
        licensePlate: r.licensePlate,
        sightingCount: r.sightingCount,
        lastSeen: r.lastSeen,
        avgCredibility: r.sightingCount > 0 ? r.credibilityTotal / r.sightingCount : 0,
      }));
  },
});

export const since = queryGeneric({
  args: {
    sinceMs: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const max = Math.min(Math.max(args.limit ?? 200, 1), 500);
    const rows = await ctx.db.query("sightings").withIndex("by_createdAt").order("desc").take(max);
    return rows.filter((row) => row.createdAt > args.sinceMs);
  },
});

export const getByNormalizedPlate = queryGeneric({
  args: {
    normalizedPlate: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const normalized = normalizePlate(args.normalizedPlate);
    const max = Math.min(Math.max(args.limit ?? 200, 1), 500);
    const rows = await ctx.db
      .query("sightings")
      .withIndex("by_normalizedPlate", (q) => q.eq("normalizedPlate", normalized))
      .order("desc")
      .take(max);
    return rows;
  },
});

export const recomputeCredibility = mutationGeneric({
  args: {
    sightingId: v.number(),
  },
  handler: async (ctx, args) => {
    const sighting = await ctx.db
      .query("sightings")
      .withIndex("by_id", (q) => q.eq("id", args.sightingId))
      .unique();
    if (!sighting) {
      throw new Error(`Sighting ${args.sightingId} not found`);
    }

    const upvotes = sighting.upvotes;
    const downvotes = sighting.downvotes;
    const credibility = calculateCredibility(upvotes, downvotes);
    const isHidden = shouldHideSighting(upvotes, downvotes, credibility);

    await ctx.db.patch(sighting._id, {
      credibilityScore: credibility.toFixed(2),
      isHidden,
      updatedAt: Date.now(),
    });

    return {
      credibility,
      isHidden,
    };
  },
});
