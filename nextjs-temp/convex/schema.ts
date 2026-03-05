import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sightings: defineTable({
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
    
    // AI fields
    agencyType: v.optional(v.string()),
    agencyMarkings: v.optional(v.string()),
    vehicleMake: v.optional(v.string()),
    vehicleModel: v.optional(v.string()),
    vehicleColor: v.optional(v.string()),
    badgeNumber: v.optional(v.string()),
    uniformDescription: v.optional(v.string()),
    aiConfidence: v.optional(v.number()),
    embedding: v.optional(v.array(v.float64())), // For RAG

    // Community
    upvotes: v.number(),
    downvotes: v.number(),
    flagCount: v.number(),
    credibilityScore: v.number(),
    isHidden: v.boolean(),
  })
    .index("by_licensePlate", ["licensePlate"])
    .index("by_deviceId", ["deviceId"])
    .index("by_credibility", ["credibilityScore"])
    // Vector index for RAG
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768, // Adjust if using a different model (e.g. 1536 for openAI)
    }),

  votes: defineTable({
    sightingId: v.id("sightings"),
    deviceId: v.string(),
    voteType: v.union(v.literal("upvote"), v.literal("downvote"), v.literal("flag")),
  })
    .index("by_sightingId", ["sightingId"])
    .index("by_deviceId_sightingId", ["deviceId", "sightingId"]),
});
