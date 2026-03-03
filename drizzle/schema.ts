import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Vehicle sightings table
export const sightings = mysqlTable("sightings", {
  id: int("id").autoincrement().primaryKey(),
  licensePlate: varchar("licensePlate", { length: 20 }).notNull(),
  vehicleType: varchar("vehicleType", { length: 50 }), // sedan, SUV, truck, van, etc.
  photoUrl: text("photoUrl").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  locationAccuracy: decimal("locationAccuracy", { precision: 8, scale: 2 }), // GPS accuracy in meters
  locationAddress: text("locationAddress"), // Reverse geocoded address
  notes: text("notes"),
  photoMetadata: text("photoMetadata"), // JSON string of EXIF data
  deviceId: varchar("deviceId", { length: 64 }), // Anonymous device identifier for tracking submissions
  // AI-extracted fields
  agencyType: varchar("agencyType", { length: 20 }), // ICE, CBP, DHS, FBI, DEA, ATF, USMS, Other
  agencyMarkings: text("agencyMarkings"), // Visible agency text/logos
  vehicleMake: varchar("vehicleMake", { length: 50 }),
  vehicleModel: varchar("vehicleModel", { length: 50 }),
  vehicleColor: varchar("vehicleColor", { length: 30 }),
  badgeNumber: varchar("badgeNumber", { length: 30 }), // Visible badge/unit number
  uniformDescription: text("uniformDescription"), // Visible uniform/tactical gear
  aiConfidence: decimal("aiConfidence", { precision: 4, scale: 3 }), // AI analysis confidence 0-1
  upvotes: int("upvotes").default(0).notNull(),
  downvotes: int("downvotes").default(0).notNull(),
  flagCount: int("flagCount").default(0).notNull(),
  credibilityScore: decimal("credibilityScore", { precision: 5, scale: 2 }).default("0").notNull(), // Calculated score
  isHidden: boolean("isHidden").default(false).notNull(), // Auto-hide if credibility too low
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  licensePlateIdx: index("licensePlate_idx").on(table.licensePlate),
  locationIdx: index("location_idx").on(table.latitude, table.longitude),
  credibilityIdx: index("credibility_idx").on(table.credibilityScore),
  createdAtIdx: index("createdAt_idx").on(table.createdAt),
}));

// Votes table (anonymous voting)
export const votes = mysqlTable("votes", {
  id: int("id").autoincrement().primaryKey(),
  sightingId: int("sightingId").notNull(),
  deviceId: varchar("deviceId", { length: 64 }).notNull(), // Anonymous device fingerprint
  voteType: mysqlEnum("voteType", ["upvote", "downvote", "flag"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  // Ensure one vote per device per sighting
  deviceSightingIdx: uniqueIndex("device_sighting_idx").on(table.deviceId, table.sightingId),
  sightingIdx: index("sighting_idx").on(table.sightingId),
}));

// Export types
export type Sighting = typeof sightings.$inferSelect;
export type InsertSighting = typeof sightings.$inferInsert;

export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;
