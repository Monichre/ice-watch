import { queryGeneric } from "convex/server";
import { v } from "convex/values";
import { normalizePlate } from "./_utils";

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "'")}"`;
}

export const plateHistory = queryGeneric({
  args: {
    licensePlate: v.string(),
    format: v.optional(v.union(v.literal("json"), v.literal("csv"))),
  },
  handler: async (ctx, args) => {
    const normalized = normalizePlate(args.licensePlate);
    const rows = await ctx.db
      .query("sightings")
      .withIndex("by_normalizedPlate", (q) => q.eq("normalizedPlate", normalized))
      .order("desc")
      .take(1000);
    const format = args.format ?? "json";

    if (format === "csv") {
      const header = [
        "id",
        "licensePlate",
        "latitude",
        "longitude",
        "locationAddress",
        "vehicleType",
        "agencyType",
        "vehicleMake",
        "vehicleModel",
        "credibilityScore",
        "upvotes",
        "downvotes",
        "createdAt",
      ].join(",");
      const lines = rows.map((row) =>
        [
          row.id,
          row.licensePlate,
          row.latitude,
          row.longitude,
          escapeCsv(row.locationAddress ?? ""),
          row.vehicleType ?? "",
          row.agencyType ?? "",
          row.vehicleMake ?? "",
          row.vehicleModel ?? "",
          row.credibilityScore,
          row.upvotes,
          row.downvotes,
          new Date(row.createdAt).toISOString(),
        ].join(","),
      );
      return { format: "csv" as const, count: rows.length, data: [header, ...lines].join("\n") };
    }

    return {
      format: "json" as const,
      count: rows.length,
      data: JSON.stringify(rows, null, 2),
    };
  },
});

export const allSightings = queryGeneric({
  args: {
    format: v.optional(v.union(v.literal("json"), v.literal("csv"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const max = Math.min(Math.max(args.limit ?? 2000, 1), 5000);
    const rows = await ctx.db.query("sightings").withIndex("by_createdAt").order("desc").take(max);
    const format = args.format ?? "json";

    if (format === "csv") {
      const header = [
        "id",
        "licensePlate",
        "latitude",
        "longitude",
        "locationAddress",
        "vehicleType",
        "agencyType",
        "credibilityScore",
        "upvotes",
        "downvotes",
        "createdAt",
      ].join(",");
      const lines = rows.map((row) =>
        [
          row.id,
          row.licensePlate,
          row.latitude,
          row.longitude,
          escapeCsv(row.locationAddress ?? ""),
          row.vehicleType ?? "",
          row.agencyType ?? "",
          row.credibilityScore,
          row.upvotes,
          row.downvotes,
          new Date(row.createdAt).toISOString(),
        ].join(","),
      );
      return { format: "csv" as const, count: rows.length, data: [header, ...lines].join("\n") };
    }

    return {
      format: "json" as const,
      count: rows.length,
      data: JSON.stringify(rows, null, 2),
    };
  },
});
