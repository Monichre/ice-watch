import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  counters: defineTable({
    name: v.string(),
    value: v.number(),
  }).index("by_name", ["name"]),

  users: defineTable({
    id: v.number(),
    openId: v.string(),
    name: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    loginMethod: v.optional(v.union(v.string(), v.null())),
    role: v.union(v.literal("user"), v.literal("admin")),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSignedIn: v.number(),
  })
    .index("by_openId", ["openId"])
    .index("by_id", ["id"]),

  sightings: defineTable({
    id: v.number(),
    licensePlate: v.string(),
    normalizedPlate: v.string(),
    vehicleType: v.optional(v.union(v.string(), v.null())),
    photoUrl: v.string(),
    latitude: v.string(),
    longitude: v.string(),
    geoBucket: v.string(),
    locationAccuracy: v.optional(v.union(v.string(), v.null())),
    locationAddress: v.optional(v.union(v.string(), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
    photoMetadata: v.optional(v.union(v.string(), v.null())),
    deviceId: v.optional(v.union(v.string(), v.null())),
    imageStorageId: v.optional(v.id("_storage")),
    agencyType: v.optional(v.union(v.string(), v.null())),
    agencyMarkings: v.optional(v.union(v.string(), v.null())),
    vehicleMake: v.optional(v.union(v.string(), v.null())),
    vehicleModel: v.optional(v.union(v.string(), v.null())),
    vehicleColor: v.optional(v.union(v.string(), v.null())),
    badgeNumber: v.optional(v.union(v.string(), v.null())),
    uniformDescription: v.optional(v.union(v.string(), v.null())),
    aiConfidence: v.optional(v.union(v.string(), v.null())),
    upvotes: v.number(),
    downvotes: v.number(),
    flagCount: v.number(),
    credibilityScore: v.string(),
    isHidden: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_createdAt", ["createdAt"])
    .index("by_licensePlate", ["licensePlate"])
    .index("by_normalizedPlate", ["normalizedPlate"])
    .index("by_geoBucket_createdAt", ["geoBucket", "createdAt"])
    .index("by_hidden_createdAt", ["isHidden", "createdAt"]),

  votes: defineTable({
    id: v.number(),
    sightingId: v.number(),
    deviceId: v.string(),
    voteType: v.union(v.literal("upvote"), v.literal("downvote"), v.literal("flag")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_sightingId", ["sightingId"])
    .index("by_device_sighting", ["deviceId", "sightingId"]),

  watchSubscriptions: defineTable({
    deviceId: v.string(),
    normalizedPlate: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_device", ["deviceId"])
    .index("by_plate", ["normalizedPlate"])
    .index("by_device_plate", ["deviceId", "normalizedPlate"]),

  uploads: defineTable({
    deviceId: v.optional(v.union(v.string(), v.null())),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    storageId: v.id("_storage"),
    fileUrl: v.string(),
    createdAt: v.number(),
  }).index("by_device_createdAt", ["deviceId", "createdAt"]),

  ragDocuments: defineTable({
    title: v.string(),
    sourceType: v.union(v.literal("manual"), v.literal("upload"), v.literal("sighting")),
    sourceRef: v.optional(v.union(v.string(), v.null())),
    createdByDeviceId: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_sourceType", ["sourceType"]),

  ragChunks: defineTable({
    documentId: v.id("ragDocuments"),
    chunkIndex: v.number(),
    content: v.string(),
    tokenCount: v.number(),
    embedding: v.optional(v.array(v.number())),
    createdAt: v.number(),
  })
    .index("by_document_chunk", ["documentId", "chunkIndex"])
    .index("by_createdAt", ["createdAt"]),

  agentRuns: defineTable({
    runKey: v.string(),
    taskType: v.string(),
    input: v.string(),
    output: v.optional(v.union(v.string(), v.null())),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    errorMessage: v.optional(v.union(v.string(), v.null())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_runKey", ["runKey"])
    .index("by_status_createdAt", ["status", "createdAt"]),
});
