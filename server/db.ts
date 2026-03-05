import { ConvexHttpClient } from "convex/browser";
import { InsertSighting, InsertUser, InsertVote, User } from "../drizzle/schema";
import { ENV } from "./_core/env";

type VoteType = "upvote" | "downvote" | "flag";

type ConvexUser = {
  id: number;
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role: "user" | "admin";
  createdAt: number;
  updatedAt: number;
  lastSignedIn: number;
};

type ConvexSighting = {
  id: number;
  licensePlate: string;
  vehicleType?: string | null;
  photoUrl: string;
  latitude: string;
  longitude: string;
  locationAccuracy?: string | null;
  locationAddress?: string | null;
  notes?: string | null;
  photoMetadata?: string | null;
  deviceId?: string | null;
  agencyType?: string | null;
  agencyMarkings?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  badgeNumber?: string | null;
  uniformDescription?: string | null;
  aiConfidence?: string | null;
  upvotes: number;
  downvotes: number;
  flagCount: number;
  credibilityScore: string;
  isHidden: boolean;
  createdAt: number;
  updatedAt: number;
};

type ConvexVote = {
  id: number;
  sightingId: number;
  deviceId: string;
  voteType: VoteType;
  createdAt: number;
  updatedAt: number;
};

let _client: ConvexHttpClient | null = null;
let _clientUrl: string | null = null;
let _warnedMissingConvexUrl = false;

function getConvexClient(): ConvexHttpClient | null {
  const convexUrl = process.env.CONVEX_URL ?? process.env.EXPO_PUBLIC_CONVEX_URL ?? "";

  if (!convexUrl) {
    if (!_warnedMissingConvexUrl) {
      console.warn("[Convex] CONVEX_URL is not set. Data operations are disabled.");
      _warnedMissingConvexUrl = true;
    }
    return null;
  }

  if (!_client || _clientUrl !== convexUrl) {
    _client = new ConvexHttpClient(convexUrl);
    _clientUrl = convexUrl;
  }

  return _client;
}

function toMillis(value: Date | string | number | undefined | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toDate(value: number | string | Date | undefined | null): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") return new Date(value);
  return new Date();
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value);
}

function normalizeRequiredString(value: unknown): string {
  return String(value ?? "");
}

function mapUser(record: ConvexUser): User {
  return {
    id: record.id,
    openId: record.openId,
    name: record.name ?? null,
    email: record.email ?? null,
    loginMethod: record.loginMethod ?? null,
    role: record.role,
    createdAt: toDate(record.createdAt),
    updatedAt: toDate(record.updatedAt),
    lastSignedIn: toDate(record.lastSignedIn),
  };
}

function mapSighting(record: ConvexSighting) {
  return {
    ...record,
    vehicleType: record.vehicleType ?? null,
    locationAccuracy: record.locationAccuracy ?? null,
    locationAddress: record.locationAddress ?? null,
    notes: record.notes ?? null,
    photoMetadata: record.photoMetadata ?? null,
    deviceId: record.deviceId ?? null,
    agencyType: record.agencyType ?? null,
    agencyMarkings: record.agencyMarkings ?? null,
    vehicleMake: record.vehicleMake ?? null,
    vehicleModel: record.vehicleModel ?? null,
    vehicleColor: record.vehicleColor ?? null,
    badgeNumber: record.badgeNumber ?? null,
    uniformDescription: record.uniformDescription ?? null,
    aiConfidence: record.aiConfidence ?? null,
    createdAt: toDate(record.createdAt),
    updatedAt: toDate(record.updatedAt),
  };
}

async function convexQuery<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex not configured");
  }
  return (await client.query(name as any, args ?? {})) as T;
}

async function convexMutation<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex not configured");
  }
  return (await client.mutation(name as any, args ?? {})) as T;
}

// Lazily create the Convex client so local tooling can run without a backend.
export async function getDb() {
  return getConvexClient();
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const client = await getDb();
  if (!client) {
    console.warn("[Convex] Cannot upsert user: Convex not available");
    return;
  }

  try {
    await convexMutation("users:upsert", {
      openId: user.openId,
      name: normalizeOptionalString(user.name),
      email: normalizeOptionalString(user.email),
      loginMethod: normalizeOptionalString(user.loginMethod),
      role: user.role,
      lastSignedIn: toMillis(user.lastSignedIn),
      ownerOpenId: ENV.ownerOpenId || undefined,
    });
  } catch (error) {
    console.error("[Convex] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const client = await getDb();
  if (!client) {
    console.warn("[Convex] Cannot get user: Convex not available");
    return undefined;
  }

  const result = await convexQuery<ConvexUser | null>("users:getByOpenId", { openId });
  return result ? mapUser(result) : undefined;
}

// ============================================================================
// Sightings
// ============================================================================

/**
 * Get all sightings with optional filters
 */
export async function getAllSightings(options?: {
  limit?: number;
  offset?: number;
  minCredibility?: number;
  hideHidden?: boolean;
}) {
  const client = await getDb();
  if (!client) return [];

  const rows = await convexQuery<ConvexSighting[]>("sightings:list", {
    limit: options?.limit,
    offset: options?.offset,
    minCredibility: options?.minCredibility,
    hideHidden: options?.hideHidden,
  });

  return rows.map(mapSighting);
}

/**
 * Get a single sighting by ID
 */
export async function getSightingById(id: number) {
  const client = await getDb();
  if (!client) return null;

  const result = await convexQuery<ConvexSighting | null>("sightings:getById", { id });
  return result ? mapSighting(result) : null;
}

/**
 * Create a new sighting
 */
export async function createSighting(data: InsertSighting) {
  const client = await getDb();
  if (!client) throw new Error("Convex not configured");

  const result = await convexMutation<{ id: number }>("sightings:create", {
    licensePlate: normalizeRequiredString(data.licensePlate),
    vehicleType: normalizeOptionalString(data.vehicleType),
    photoUrl: normalizeRequiredString(data.photoUrl),
    latitude: normalizeRequiredString(data.latitude),
    longitude: normalizeRequiredString(data.longitude),
    locationAccuracy: normalizeOptionalString(data.locationAccuracy),
    locationAddress: normalizeOptionalString(data.locationAddress),
    notes: normalizeOptionalString(data.notes),
    photoMetadata: normalizeOptionalString(data.photoMetadata),
    deviceId: normalizeOptionalString(data.deviceId),
    agencyType: normalizeOptionalString(data.agencyType),
    agencyMarkings: normalizeOptionalString(data.agencyMarkings),
    vehicleMake: normalizeOptionalString(data.vehicleMake),
    vehicleModel: normalizeOptionalString(data.vehicleModel),
    vehicleColor: normalizeOptionalString(data.vehicleColor),
    badgeNumber: normalizeOptionalString(data.badgeNumber),
    uniformDescription: normalizeOptionalString(data.uniformDescription),
    aiConfidence: normalizeOptionalString(data.aiConfidence),
  });

  return result.id;
}

/**
 * Update sighting vote counts and credibility score
 */
export async function updateSightingVotes(
  sightingId: number,
  upvotes: number,
  downvotes: number,
  flagCount: number
) {
  const client = await getDb();
  if (!client) throw new Error("Convex not configured");

  await convexMutation("sightings:updateVotes", {
    sightingId,
    upvotes,
    downvotes,
    flagCount,
  });
}

/**
 * Search sightings by license plate
 */
export async function searchSightingsByLicensePlate(licensePlate: string) {
  const client = await getDb();
  if (!client) return [];

  const rows = await convexQuery<ConvexSighting[]>("sightings:searchByLicensePlate", {
    licensePlate,
  });

  return rows.map(mapSighting);
}

/**
 * Get sightings near a location (within radius in kilometers)
 */
export async function getSightingsNearLocation(
  latitude: number,
  longitude: number,
  radiusKm: number = 10
) {
  const client = await getDb();
  if (!client) return [];

  const rows = await convexQuery<
    Array<{
      id: number;
      licensePlate: string;
      vehicleType: string | null;
      photoUrl: string;
      latitude: string;
      longitude: string;
      locationAddress: string | null;
      upvotes: number;
      downvotes: number;
      credibilityScore: string;
      createdAt: number;
      distance: number;
    }>
  >("sightings:nearby", {
    latitude,
    longitude,
    radiusKm,
  });

  return rows.map((row) => ({
    ...row,
    createdAt: toDate(row.createdAt),
  }));
}

// ============================================================================
// Votes
// ============================================================================

/**
 * Get a user's vote for a specific sighting
 */
export async function getUserVote(deviceId: string, sightingId: number) {
  const client = await getDb();
  if (!client) return null;

  const result = await convexQuery<ConvexVote | null>("votes:getUserVote", {
    deviceId,
    sightingId,
  });

  if (!result) return null;

  return {
    ...result,
    createdAt: toDate(result.createdAt),
    updatedAt: toDate(result.updatedAt),
  };
}

/**
 * Cast or update a vote
 */
export async function castVote(data: InsertVote) {
  const client = await getDb();
  if (!client) throw new Error("Convex not configured");

  await convexMutation("votes:cast", {
    deviceId: data.deviceId,
    sightingId: data.sightingId,
    voteType: data.voteType as VoteType,
    nowMs: Date.now(),
  });
}

/**
 * Remove a vote
 */
export async function removeVote(deviceId: string, sightingId: number) {
  const client = await getDb();
  if (!client) throw new Error("Convex not configured");

  await convexMutation("votes:remove", {
    deviceId,
    sightingId,
    nowMs: Date.now(),
  });
}

/**
 * Get vote counts for a sighting
 */
export async function getVoteCounts(sightingId: number) {
  const client = await getDb();
  if (!client) return { upvotes: 0, downvotes: 0, flagCount: 0 };

  return await convexQuery<{ upvotes: number; downvotes: number; flagCount: number }>("votes:getCounts", {
    sightingId,
  });
}

/**
 * Get all tracked plates with sighting counts
 */
export async function getAllTrackedPlates(limit: number = 50) {
  const client = await getDb();
  if (!client) return [];

  const rows = await convexQuery<
    Array<{
      licensePlate: string;
      sightingCount: number;
      lastSeen: number;
      avgCredibility: number;
    }>
  >("sightings:getAllTrackedPlates", {
    limit,
  });

  return rows.map((row) => ({
    ...row,
    lastSeen: toDate(row.lastSeen),
  }));
}
