import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, sightings, votes, InsertSighting, InsertVote } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
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
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(sightings);

  if (options?.hideHidden) {
    query = query.where(eq(sightings.isHidden, false)) as any;
  }

  if (options?.minCredibility !== undefined) {
    const credFilter = sql`${sightings.credibilityScore} >= ${options.minCredibility}`;
    query = query.where(credFilter) as any;
  }

  query = query.orderBy(desc(sightings.createdAt)) as any;

  if (options?.limit) {
    query = query.limit(options.limit) as any;
  }

  if (options?.offset) {
    query = query.offset(options.offset) as any;
  }

  return query;
}

/**
 * Get a single sighting by ID
 */
export async function getSightingById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const results = await db.select().from(sightings).where(eq(sightings.id, id));
  return results[0] || null;
}

/**
 * Create a new sighting
 */
export async function createSighting(data: InsertSighting) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(sightings).values(data);
  return Number(result[0].insertId);
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
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Calculate credibility score
  const totalVotes = upvotes + downvotes;
  const credibilityScore = totalVotes > 0 ? (upvotes / totalVotes) * 100 : 0;

  // Auto-hide if credibility is too low and has enough votes
  const isHidden = totalVotes >= 5 && credibilityScore < 40;

  await db
    .update(sightings)
    .set({
      upvotes,
      downvotes,
      flagCount,
      credibilityScore: credibilityScore.toFixed(2),
      isHidden,
    })
    .where(eq(sightings.id, sightingId));
}

/**
 * Search sightings by license plate
 */
export async function searchSightingsByLicensePlate(licensePlate: string) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(sightings)
    .where(sql`${sightings.licensePlate} LIKE ${`%${licensePlate}%`}`)
    .orderBy(desc(sightings.createdAt));
}

/**
 * Get sightings near a location (within radius in kilometers)
 */
export async function getSightingsNearLocation(
  latitude: number,
  longitude: number,
  radiusKm: number = 10
) {
  const db = await getDb();
  if (!db) return [];

  // Haversine formula for distance calculation
  const distanceFormula = sql`(
    6371 * acos(
      cos(radians(${latitude})) *
      cos(radians(${sightings.latitude})) *
      cos(radians(${sightings.longitude}) - radians(${longitude})) +
      sin(radians(${latitude})) *
      sin(radians(${sightings.latitude}))
    )
  )`;

  return db
    .select({
      id: sightings.id,
      licensePlate: sightings.licensePlate,
      vehicleType: sightings.vehicleType,
      photoUrl: sightings.photoUrl,
      latitude: sightings.latitude,
      longitude: sightings.longitude,
      locationAddress: sightings.locationAddress,
      upvotes: sightings.upvotes,
      downvotes: sightings.downvotes,
      credibilityScore: sightings.credibilityScore,
      createdAt: sightings.createdAt,
      distance: distanceFormula.as("distance"),
    })
    .from(sightings)
    .where(sql`${distanceFormula} <= ${radiusKm}`)
    .orderBy(sql`distance ASC`);
}

// ============================================================================
// Votes
// ============================================================================

/**
 * Get a user's vote for a specific sighting
 */
export async function getUserVote(deviceId: string, sightingId: number) {
  const db = await getDb();
  if (!db) return null;

  const results = await db
    .select()
    .from(votes)
    .where(and(eq(votes.deviceId, deviceId), eq(votes.sightingId, sightingId)));

  return results[0] || null;
}

/**
 * Cast or update a vote
 */
export async function castVote(data: InsertVote) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if vote already exists
  const existingVote = await getUserVote(data.deviceId, data.sightingId);

  if (existingVote) {
    // Update existing vote
    await db
      .update(votes)
      .set({ voteType: data.voteType })
      .where(and(eq(votes.deviceId, data.deviceId), eq(votes.sightingId, data.sightingId)));
  } else {
    // Insert new vote
    await db.insert(votes).values(data);
  }

  // Recalculate sighting vote counts
  await recalculateSightingVotes(data.sightingId);
}

/**
 * Remove a vote
 */
export async function removeVote(deviceId: string, sightingId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(votes).where(and(eq(votes.deviceId, deviceId), eq(votes.sightingId, sightingId)));

  // Recalculate sighting vote counts
  await recalculateSightingVotes(sightingId);
}

/**
 * Recalculate vote counts for a sighting
 */
async function recalculateSightingVotes(sightingId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const allVotes = await db.select().from(votes).where(eq(votes.sightingId, sightingId));

  const upvotes = allVotes.filter((v) => v.voteType === "upvote").length;
  const downvotes = allVotes.filter((v) => v.voteType === "downvote").length;
  const flagCount = allVotes.filter((v) => v.voteType === "flag").length;

  await updateSightingVotes(sightingId, upvotes, downvotes, flagCount);
}

/**
 * Get vote counts for a sighting
 */
export async function getVoteCounts(sightingId: number) {
  const db = await getDb();
  if (!db) return { upvotes: 0, downvotes: 0, flagCount: 0 };

  const allVotes = await db.select().from(votes).where(eq(votes.sightingId, sightingId));

  return {
    upvotes: allVotes.filter((v) => v.voteType === "upvote").length,
    downvotes: allVotes.filter((v) => v.voteType === "downvote").length,
    flagCount: allVotes.filter((v) => v.voteType === "flag").length,
  };
}
