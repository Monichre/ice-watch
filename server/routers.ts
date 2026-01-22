import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Sightings routes (all public - anonymous app)
  sightings: router({
    // Get all sightings with optional filters
    list: publicProcedure
      .input(
        z
          .object({
            limit: z.number().min(1).max(100).optional(),
            offset: z.number().min(0).optional(),
            minCredibility: z.number().min(0).max(100).optional(),
            hideHidden: z.boolean().optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return db.getAllSightings(input);
      }),

    // Get single sighting by ID
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getSightingById(input.id);
    }),

    // Create new sighting
    create: publicProcedure
      .input(
        z.object({
          licensePlate: z.string().min(1).max(20),
          vehicleType: z.string().max(50).optional(),
          photoBase64: z.string(), // Base64 encoded photo
          latitude: z.number(),
          longitude: z.number(),
          locationAccuracy: z.number().optional(),
          locationAddress: z.string().optional(),
          notes: z.string().optional(),
          photoMetadata: z.string().optional(), // JSON string
          deviceId: z.string().max(64),
        })
      )
      .mutation(async ({ input }) => {
        // Upload photo to S3
        const photoBuffer = Buffer.from(input.photoBase64, "base64");
        const timestamp = Date.now();
        const fileName = `sightings/${input.deviceId}-${timestamp}.jpg`;
        const { url: photoUrl } = await storagePut(fileName, photoBuffer, "image/jpeg");

        // Create sighting record
        const sightingId = await db.createSighting({
          licensePlate: input.licensePlate,
          vehicleType: input.vehicleType,
          photoUrl,
          latitude: input.latitude.toString(),
          longitude: input.longitude.toString(),
          locationAccuracy: input.locationAccuracy?.toString(),
          locationAddress: input.locationAddress,
          notes: input.notes,
          photoMetadata: input.photoMetadata,
          deviceId: input.deviceId,
        });

        return { id: sightingId, photoUrl };
      }),

    // Search by license plate
    search: publicProcedure
      .input(z.object({ licensePlate: z.string().min(1) }))
      .query(async ({ input }) => {
        return db.searchSightingsByLicensePlate(input.licensePlate);
      }),

    // Get nearby sightings
    nearby: publicProcedure
      .input(
        z.object({
          latitude: z.number(),
          longitude: z.number(),
          radiusKm: z.number().min(0.1).max(100).optional(),
        })
      )
      .query(async ({ input }) => {
        return db.getSightingsNearLocation(input.latitude, input.longitude, input.radiusKm);
      }),
  }),

  // Voting routes (all public - anonymous voting)
  votes: router({
    // Get user's vote for a sighting
    getUserVote: publicProcedure
      .input(z.object({ deviceId: z.string(), sightingId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserVote(input.deviceId, input.sightingId);
      }),

    // Cast or update a vote
    cast: publicProcedure
      .input(
        z.object({
          deviceId: z.string().max(64),
          sightingId: z.number(),
          voteType: z.enum(["upvote", "downvote", "flag"]),
        })
      )
      .mutation(async ({ input }) => {
        await db.castVote(input);
        return { success: true };
      }),

    // Remove a vote
    remove: publicProcedure
      .input(z.object({ deviceId: z.string(), sightingId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeVote(input.deviceId, input.sightingId);
        return { success: true };
      }),

    // Get vote counts for a sighting
    getCounts: publicProcedure.input(z.object({ sightingId: z.number() })).query(async ({ input }) => {
      return db.getVoteCounts(input.sightingId);
    }),
  }),
});

export type AppRouter = typeof appRouter;
