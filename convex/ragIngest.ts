import { mutationGeneric } from "convex/server";
import { v } from "convex/values";
import { chunkText, fallbackEmbedding } from "./_utils";

export const ingestSighting = mutationGeneric({
  args: {
    sightingId: v.number(),
    createdByDeviceId: v.optional(v.union(v.string(), v.null())),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const sighting = await ctx.db
      .query("sightings")
      .withIndex("by_id", (q) => q.eq("id", args.sightingId))
      .unique();
    if (!sighting) {
      throw new Error(`Sighting ${args.sightingId} not found`);
    }

    const content = [
      `License plate: ${sighting.licensePlate}`,
      sighting.vehicleType ? `Vehicle type: ${sighting.vehicleType}` : "",
      sighting.locationAddress ? `Location: ${sighting.locationAddress}` : "",
      `Coordinates: ${sighting.latitude}, ${sighting.longitude}`,
      sighting.agencyType ? `Agency: ${sighting.agencyType}` : "",
      sighting.agencyMarkings ? `Agency markings: ${sighting.agencyMarkings}` : "",
      sighting.vehicleMake ? `Make: ${sighting.vehicleMake}` : "",
      sighting.vehicleModel ? `Model: ${sighting.vehicleModel}` : "",
      sighting.vehicleColor ? `Color: ${sighting.vehicleColor}` : "",
      sighting.badgeNumber ? `Badge/unit: ${sighting.badgeNumber}` : "",
      sighting.uniformDescription ? `Uniform: ${sighting.uniformDescription}` : "",
      sighting.notes ? `Notes: ${sighting.notes}` : "",
      `Credibility score: ${sighting.credibilityScore}`,
      `Created at: ${new Date(sighting.createdAt).toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");

    const documentId = await ctx.db.insert("ragDocuments", {
      title: `Sighting ${sighting.licensePlate} #${sighting.id}`,
      sourceType: "sighting",
      sourceRef: String(sighting.id),
      createdByDeviceId: args.createdByDeviceId ?? null,
      createdAt: args.nowMs,
      updatedAt: args.nowMs,
    });

    const chunks = chunkText(content, 500, 80);
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i]!;
      await ctx.db.insert("ragChunks", {
        documentId,
        chunkIndex: i,
        content: chunk,
        tokenCount: chunk.split(/\s+/).length,
        embedding: fallbackEmbedding(chunk),
        createdAt: args.nowMs,
      });
    }

    return { documentId, chunkCount: chunks.length };
  },
});
