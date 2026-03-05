import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { assertRateLimit } from "./_utils";

export const generateUploadUrl = mutationGeneric({
  args: {
    deviceId: v.optional(v.union(v.string(), v.null())),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.deviceId) {
      await assertRateLimit(ctx, `upload-url:${args.deviceId}`, 60, 60_000, args.nowMs);
    }
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const registerUpload = mutationGeneric({
  args: {
    deviceId: v.optional(v.union(v.string(), v.null())),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    storageId: v.id("_storage"),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const fileUrl = await ctx.storage.getUrl(args.storageId);
    if (!fileUrl) {
      throw new Error("Unable to resolve uploaded file URL");
    }

    const uploadId = await ctx.db.insert("uploads", {
      deviceId: args.deviceId ?? null,
      fileName: args.fileName,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      storageId: args.storageId,
      fileUrl,
      createdAt: args.nowMs,
    });

    return {
      uploadId,
      fileUrl,
    };
  },
});

export const getRecentUploads = queryGeneric({
  args: {
    deviceId: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const max = Math.min(Math.max(args.limit ?? 50, 1), 200);
    if (args.deviceId) {
      return ctx.db
        .query("uploads")
        .withIndex("by_device_createdAt", (q) => q.eq("deviceId", args.deviceId))
        .order("desc")
        .take(max);
    }
    return ctx.db.query("uploads").order("desc").take(max);
  },
});
