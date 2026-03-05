import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { fallbackEmbedding, normalizePlate, cosineSimilarity } from "./_utils";

function buildHeuristicAnswer(query: string, chunks: Array<{ title: string; content: string }>): string {
  if (chunks.length === 0) {
    return `No indexed evidence found for: "${query}".`;
  }

  const opening = `Evidence summary for "${query}":`;
  const bulletLines = chunks.slice(0, 4).map((chunk, index) => {
    const excerpt = chunk.content.length > 220 ? `${chunk.content.slice(0, 220)}...` : chunk.content;
    return `${index + 1}. [${chunk.title}] ${excerpt}`;
  });
  return [opening, ...bulletLines].join("\n");
}

export const runRagAgent = mutationGeneric({
  args: {
    query: v.string(),
    normalizedPlate: v.optional(v.string()),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const runKey = `run_${args.nowMs}_${Math.random().toString(36).slice(2, 8)}`;

    const runId = await ctx.db.insert("agentRuns", {
      runKey,
      taskType: "rag_qa",
      input: args.query,
      output: null,
      status: "running",
      errorMessage: null,
      createdAt: args.nowMs,
      updatedAt: args.nowMs,
    });

    try {
      const queryEmbedding = fallbackEmbedding(args.query);
      const queryTokens = args.query.toLowerCase().split(/\s+/).filter(Boolean);
      const plateToken = args.normalizedPlate ? normalizePlate(args.normalizedPlate) : "";
      const chunks = await ctx.db.query("ragChunks").withIndex("by_createdAt").order("desc").take(2000);
      const documentsCache = new Map<string, Awaited<ReturnType<typeof ctx.db.get>>>();

      const scored = chunks
        .map((chunk) => {
          const cosine = chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0;
          const lexicalHits = queryTokens.reduce(
            (count, token) => count + (chunk.content.toLowerCase().includes(token) ? 1 : 0),
            0,
          );
          const lexicalScore = queryTokens.length > 0 ? lexicalHits / queryTokens.length : 0;
          const plateBonus = plateToken && chunk.content.includes(plateToken) ? 0.2 : 0;
          return {
            chunk,
            score: cosine * 0.6 + lexicalScore * 0.4 + plateBonus,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      const evidence: Array<{ chunkId: string; title: string; content: string; score: number }> = [];
      for (const item of scored) {
        const key = String(item.chunk.documentId);
        if (!documentsCache.has(key)) {
          documentsCache.set(key, await ctx.db.get(item.chunk.documentId));
        }
        const title = documentsCache.get(key)?.title ?? "Untitled";
        evidence.push({
          chunkId: String(item.chunk._id),
          title,
          content: item.chunk.content,
          score: item.score,
        });
      }

      const answer = buildHeuristicAnswer(args.query, evidence);
      await ctx.db.patch(runId, {
        status: "completed",
        output: answer,
        updatedAt: Date.now(),
      });

      return {
        runKey,
        answer,
        citations: evidence.map((item) => ({
          chunkId: item.chunkId,
          title: item.title,
          score: Number(item.score.toFixed(3)),
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown agent error";
      await ctx.db.patch(runId, {
        status: "failed",
        errorMessage,
        updatedAt: Date.now(),
      });
      throw error;
    }
  },
});

export const getRun = queryGeneric({
  args: {
    runKey: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("agentRuns")
      .withIndex("by_runKey", (q) => q.eq("runKey", args.runKey))
      .unique();
  },
});
