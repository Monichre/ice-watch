import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { chunkText, cosineSimilarity, fallbackEmbedding } from "./_utils";

export const ingestDocument = mutationGeneric({
  args: {
    title: v.string(),
    sourceType: v.union(v.literal("manual"), v.literal("upload"), v.literal("sighting")),
    sourceRef: v.optional(v.union(v.string(), v.null())),
    createdByDeviceId: v.optional(v.union(v.string(), v.null())),
    content: v.string(),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const chunks = chunkText(args.content);
    if (chunks.length === 0) {
      throw new Error("Document content is empty");
    }

    const documentId = await ctx.db.insert("ragDocuments", {
      title: args.title,
      sourceType: args.sourceType,
      sourceRef: args.sourceRef ?? null,
      createdByDeviceId: args.createdByDeviceId ?? null,
      createdAt: args.nowMs,
      updatedAt: args.nowMs,
    });

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i]!;
      const tokenCount = chunk.split(/\s+/).length;
      const embedding = fallbackEmbedding(chunk);
      await ctx.db.insert("ragChunks", {
        documentId,
        chunkIndex: i,
        content: chunk,
        tokenCount,
        embedding,
        createdAt: args.nowMs,
      });
    }

    return {
      documentId,
      chunkCount: chunks.length,
    };
  },
});

export const listDocuments = queryGeneric({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const max = Math.min(Math.max(args.limit ?? 100, 1), 500);
    return ctx.db.query("ragDocuments").withIndex("by_createdAt").order("desc").take(max);
  },
});

export const search = queryGeneric({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const max = Math.min(Math.max(args.limit ?? 8, 1), 25);
    const queryEmbedding = fallbackEmbedding(args.query);
    const queryTokens = args.query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const chunks = await ctx.db.query("ragChunks").withIndex("by_createdAt").order("desc").take(2000);
    const scored = chunks
      .map((chunk) => {
        const cosine = chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0;
        const lexicalHits = queryTokens.reduce(
          (acc, token) => acc + (chunk.content.toLowerCase().includes(token) ? 1 : 0),
          0,
        );
        const lexicalScore = queryTokens.length > 0 ? lexicalHits / queryTokens.length : 0;
        return {
          ...chunk,
          score: cosine * 0.65 + lexicalScore * 0.35,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, max);

    const documents = new Map<string, Awaited<ReturnType<typeof ctx.db.get>>>();
    for (const chunk of scored) {
      const key = String(chunk.documentId);
      if (!documents.has(key)) {
        const doc = await ctx.db.get(chunk.documentId);
        documents.set(key, doc);
      }
    }

    return scored.map((chunk) => ({
      chunkId: chunk._id,
      documentId: chunk.documentId,
      title: documents.get(String(chunk.documentId))?.title ?? "Untitled",
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      score: chunk.score,
    }));
  },
});
