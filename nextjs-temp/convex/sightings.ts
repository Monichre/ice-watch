import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
    minCredibility: v.optional(v.number()),
    hideHidden: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let sightingsQuery = ctx.db.query("sightings").order("desc");
    let sightings = await sightingsQuery.take(args.limit ?? 100);

    if (args.hideHidden) {
      sightings = sightings.filter((s) => !s.isHidden);
    }

    if (args.minCredibility !== undefined) {
      sightings = sightings.filter((s) => s.credibilityScore >= (args.minCredibility ?? 0));
    }

    // Add photo URLs
    return await Promise.all(
      sightings.map(async (sighting) => ({
        ...sighting,
        photoUrl: sighting.photoId ? await ctx.storage.getUrl(sighting.photoId) : sighting.photoUrl,
      }))
    );
  },
});

export const getById = query({
  args: { id: v.id("sightings") },
  handler: async (ctx, args) => {
    const sighting = await ctx.db.get(args.id);
    if (!sighting) return null;
    return {
      ...sighting,
      photoUrl: sighting.photoId ? await ctx.storage.getUrl(sighting.photoId) : sighting.photoUrl,
    };
  },
});

export const create = mutation({
  args: {
    licensePlate: v.string(),
    vehicleType: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
    latitude: v.number(),
    longitude: v.number(),
    locationAccuracy: v.optional(v.number()),
    locationAddress: v.optional(v.string()),
    notes: v.optional(v.string()),
    photoMetadata: v.optional(v.string()),
    deviceId: v.string(),
    agencyType: v.optional(v.string()),
    agencyMarkings: v.optional(v.string()),
    vehicleMake: v.optional(v.string()),
    vehicleModel: v.optional(v.string()),
    vehicleColor: v.optional(v.string()),
    badgeNumber: v.optional(v.string()),
    uniformDescription: v.optional(v.string()),
    aiConfidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sightingId = await ctx.db.insert("sightings", {
      ...args,
      upvotes: 0,
      downvotes: 0,
      flagCount: 0,
      credibilityScore: 0,
      isHidden: false,
    });
    return sightingId;
  },
});

export const search = query({
  args: { licensePlate: v.string() },
  handler: async (ctx, args) => {
    const sightings = await ctx.db
      .query("sightings")
      .withIndex("by_licensePlate", (q) => q.eq("licensePlate", args.licensePlate))
      .order("desc")
      .collect();
      
    return await Promise.all(
      sightings.map(async (sighting) => ({
        ...sighting,
        photoUrl: sighting.photoId ? await ctx.storage.getUrl(sighting.photoId) : sighting.photoUrl,
      }))
    );
  },
});

export const nearby = query({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    radiusKm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const radiusKm = args.radiusKm ?? 10;
    const allSightings = await ctx.db.query("sightings").order("desc").take(500);

    const R = 6371; 
    const filtered = allSightings.filter((s) => {
      const dLat = ((s.latitude - args.latitude) * Math.PI) / 180;
      const dLon = ((s.longitude - args.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((args.latitude * Math.PI) / 180) *
          Math.cos((s.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      return distance <= radiusKm;
    });

    return await Promise.all(
      filtered.map(async (sighting) => ({
        ...sighting,
        photoUrl: sighting.photoId ? await ctx.storage.getUrl(sighting.photoId) : sighting.photoUrl,
      }))
    );
  },
});
