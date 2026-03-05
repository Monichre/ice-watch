import type { GenericMutationCtx } from "convex/server";

export async function nextCounterValue(ctx: GenericMutationCtx<any>, name: string): Promise<number> {
  const existing = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();

  if (!existing) {
    await ctx.db.insert("counters", { name, value: 1 });
    return 1;
  }

  const next = existing.value + 1;
  await ctx.db.patch(existing._id, { value: next });
  return next;
}

export function calculateCredibility(upvotes: number, downvotes: number): number {
  const totalVotes = upvotes + downvotes;
  if (totalVotes <= 0) return 0;
  return (upvotes / totalVotes) * 100;
}

export function shouldHideSighting(upvotes: number, downvotes: number, credibility: number): boolean {
  const totalVotes = upvotes + downvotes;
  return totalVotes >= 5 && credibility < 40;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

export function toGeoBucket(latitude: number, longitude: number, precision = 2): string {
  const latBucket = latitude.toFixed(precision);
  const lngBucket = longitude.toFixed(precision);
  return `${latBucket}:${lngBucket}`;
}

export function nearbyGeoBuckets(
  latitude: number,
  longitude: number,
  radiusKm: number,
  precision = 2,
): string[] {
  const buckets = new Set<string>();
  const latStep = 10 ** -precision;
  const lngStep = 10 ** -precision;
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180) || 1);

  for (let lat = latitude - latDelta; lat <= latitude + latDelta; lat += latStep) {
    for (let lng = longitude - lngDelta; lng <= longitude + lngDelta; lng += lngStep) {
      buckets.add(toGeoBucket(lat, lng, precision));
    }
  }

  buckets.add(toGeoBucket(latitude, longitude, precision));
  return Array.from(buckets);
}

export function chunkText(content: string, chunkSize = 800, overlap = 120): string[] {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const end = Math.min(cursor + chunkSize, normalized.length);
    const chunk = normalized.slice(cursor, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    if (end >= normalized.length) break;
    cursor = Math.max(0, end - overlap);
  }
  return chunks;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function fallbackEmbedding(content: string, dimensions = 64): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  for (let i = 0; i < content.length; i += 1) {
    const code = content.charCodeAt(i);
    vector[i % dimensions] += code / 255;
  }
  return vector;
}

export async function assertRateLimit(
  ctx: GenericMutationCtx<any>,
  key: string,
  limit: number,
  windowMs: number,
  nowMs: number,
): Promise<void> {
  const windowBucket = Math.floor(nowMs / windowMs);
  const counterName = `rate:${key}:${windowBucket}`;
  const existing = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", counterName))
    .unique();

  if (!existing) {
    await ctx.db.insert("counters", { name: counterName, value: 1 });
    return;
  }

  if (existing.value >= limit) {
    throw new Error("Rate limit exceeded");
  }

  await ctx.db.patch(existing._id, { value: existing.value + 1 });
}
