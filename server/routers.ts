import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";

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
          // AI-extracted fields
          agencyType: z.string().optional(),
          agencyMarkings: z.string().optional(),
          vehicleMake: z.string().optional(),
          vehicleModel: z.string().optional(),
          vehicleColor: z.string().optional(),
          badgeNumber: z.string().optional(),
          uniformDescription: z.string().optional(),
          aiConfidence: z.number().optional(),
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
          agencyType: input.agencyType,
          agencyMarkings: input.agencyMarkings,
          vehicleMake: input.vehicleMake,
          vehicleModel: input.vehicleModel,
          vehicleColor: input.vehicleColor,
          badgeNumber: input.badgeNumber,
          uniformDescription: input.uniformDescription,
          aiConfidence: input.aiConfidence?.toString(),
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

  // AI Vehicle & Agency Analysis
  vehicleAI: router({
    analyzePhoto: publicProcedure
      .input(z.object({ imageUrl: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Analyze this photo of a vehicle and return a JSON object with these fields:
- licensePlate: string (the license plate number, uppercase no spaces, or "" if not visible)
- vehicleMake: string (e.g. "Ford", "Chevrolet", or "" if unknown)
- vehicleModel: string (e.g. "Explorer", "Tahoe", or "" if unknown)
- vehicleColor: string (e.g. "Black", "White", or "" if unknown)
- vehicleType: string (one of: "Sedan", "SUV", "Truck", "Van", "Motorcycle", "Other")
- agencyType: string (one of: "ICE", "CBP", "DHS", "FBI", "DEA", "ATF", "USMS", "Other", or "" if no agency markings visible)
- agencyMarkings: string (describe any visible agency text, logos, or insignia, or "" if none)
- badgeNumber: string (any visible badge or unit number, or "" if not visible)
- uniformDescription: string (brief description of any visible uniform or tactical gear, or "" if none)
- confidence: number (0-1, your confidence in the agency identification)

Return ONLY valid JSON, no explanation.`,
                  },
                  {
                    type: "image_url",
                    image_url: { url: input.imageUrl, detail: "high" },
                  },
                ],
              },
            ],
          });

          const content = response.choices[0]?.message?.content;
          const text = typeof content === "string" ? content.trim() : "{}";
          // Strip markdown code fences if present
          const jsonText = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
          const result = JSON.parse(jsonText);
          return {
            licensePlate: (result.licensePlate || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
            vehicleMake: result.vehicleMake || "",
            vehicleModel: result.vehicleModel || "",
            vehicleColor: result.vehicleColor || "",
            vehicleType: result.vehicleType || "Other",
            agencyType: result.agencyType || "",
            agencyMarkings: result.agencyMarkings || "",
            badgeNumber: result.badgeNumber || "",
            uniformDescription: result.uniformDescription || "",
            confidence: result.confidence || 0,
          };
        } catch (error) {
          console.error("Vehicle AI error:", error);
          return {
            licensePlate: "", vehicleMake: "", vehicleModel: "",
            vehicleColor: "", vehicleType: "Other", agencyType: "",
            agencyMarkings: "", badgeNumber: "", uniformDescription: "",
            confidence: 0,
          };
        }
      }),
  }),

  // License Plate Recognition
  alpr: router({
    extractPlate: publicProcedure
      .input(z.object({ imageUrl: z.string().url() }))
      .mutation(async ({ input }) => {
        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract the license plate number from this image. Return ONLY the plate number with no spaces, dashes, or other characters. If you cannot find a clear license plate, return 'UNKNOWN'.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: input.imageUrl,
                      detail: "high",
                    },
                  },
                ],
              },
            ],
          });

          const content = response.choices[0]?.message?.content;
          const plateText = (typeof content === "string" ? content.trim() : "UNKNOWN") || "UNKNOWN";
          
          // Normalize plate: uppercase, remove spaces/dashes
          const normalizedPlate = plateText.toUpperCase().replace(/[^A-Z0-9]/g, "");
          
          return {
            plate: normalizedPlate === "UNKNOWN" ? "" : normalizedPlate,
            confidence: normalizedPlate === "UNKNOWN" ? 0 : 0.85,
            raw: plateText,
          };
        } catch (error) {
          console.error("ALPR error:", error);
          return {
            plate: "",
            confidence: 0,
            raw: "ERROR",
          };
        }
      }),
  }),

  // Plate tracking routes
  plates: router({
    // Get all sightings for a specific plate
    getByPlate: publicProcedure
      .input(z.object({ licensePlate: z.string().min(1) }))
      .query(async ({ input }) => {
        // Normalize the search plate
        const normalizedPlate = input.licensePlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
        return db.searchSightingsByLicensePlate(normalizedPlate);
      }),

    // Get list of all tracked plates with sighting counts
    listAll: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllTrackedPlates(input?.limit);
      }),
  }),

  // Convoy detection - finds multiple vehicles sighted in same area within a time window
  convoy: router({
    detect: publicProcedure
      .input(z.object({
        radiusKm: z.number().min(0.1).max(10).optional(),
        windowMinutes: z.number().min(1).max(60).optional(),
        minVehicles: z.number().min(2).max(10).optional(),
      }).optional())
      .query(async ({ input }) => {
        const radiusKm = input?.radiusKm ?? 0.5;
        const windowMinutes = input?.windowMinutes ?? 15;
        const minVehicles = input?.minVehicles ?? 2;

        // Get all sightings from the last windowMinutes * 2
        const allSightings = await db.getAllSightings({ limit: 500, hideHidden: true });
        const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
        const recent = allSightings.filter((s: any) => new Date(s.createdAt) >= cutoff);

        if (recent.length < minVehicles) return [];

        // Cluster sightings by proximity
        const R = 6371;
        const dist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLon = ((lon2 - lon1) * Math.PI) / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        };

        const convoys: Array<{
          centerLat: number;
          centerLon: number;
          vehicleCount: number;
          plates: string[];
          agencies: string[];
          firstSeen: Date;
          lastSeen: Date;
        }> = [];

        const used = new Set<number>();
        for (let i = 0; i < recent.length; i++) {
          if (used.has(i)) continue;
          const group = [recent[i]];
          used.add(i);
          const lat1 = parseFloat(recent[i].latitude);
          const lon1 = parseFloat(recent[i].longitude);
          for (let j = i + 1; j < recent.length; j++) {
            if (used.has(j)) continue;
            const lat2 = parseFloat(recent[j].latitude);
            const lon2 = parseFloat(recent[j].longitude);
            if (dist(lat1, lon1, lat2, lon2) <= radiusKm) {
              group.push(recent[j]);
              used.add(j);
            }
          }
          if (group.length >= minVehicles) {
            const lats = group.map((s: any) => parseFloat(s.latitude));
            const lons = group.map((s: any) => parseFloat(s.longitude));
            const plates = [...new Set(group.map((s: any) => s.licensePlate))];
            const agencies = [...new Set(group.map((s: any) => s.agencyType).filter(Boolean))];
            const times = group.map((s: any) => new Date(s.createdAt).getTime());
            convoys.push({
              centerLat: lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
              centerLon: lons.reduce((a: number, b: number) => a + b, 0) / lons.length,
              vehicleCount: group.length,
              plates,
              agencies,
              firstSeen: new Date(Math.min(...times)),
              lastSeen: new Date(Math.max(...times)),
            });
          }
        }

        return convoys.sort((a, b) => b.vehicleCount - a.vehicleCount);
      }),
  }),

  // Trending plates - most reported in last 24h
  trending: router({
    plates: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
      .query(async ({ input }) => {
        const limit = input?.limit ?? 10;
        const allSightings = await db.getAllSightings({ limit: 500, hideHidden: true });
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = allSightings.filter((s: any) => new Date(s.createdAt) >= cutoff);

        const counts: Record<string, {
          plate: string;
          count: number;
          lastSeen: Date;
          agencyType: string | null;
          credibilitySum: number;
        }> = {};

        for (const s of recent) {
          const plate = s.licensePlate;
          if (!counts[plate]) {
            counts[plate] = { plate, count: 0, lastSeen: new Date(s.createdAt), agencyType: (s as any).agencyType || null, credibilitySum: 0 };
          }
          counts[plate].count++;
          counts[plate].credibilitySum += parseFloat(s.credibilityScore);
          if (new Date(s.createdAt) > counts[plate].lastSeen) {
            counts[plate].lastSeen = new Date(s.createdAt);
            counts[plate].agencyType = (s as any).agencyType || counts[plate].agencyType;
          }
        }

        return Object.values(counts)
          .sort((a, b) => b.count - a.count)
          .slice(0, limit)
          .map((c) => ({
            ...c,
            avgCredibility: c.credibilitySum / c.count,
          }));
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

  // Shareable link generation
  share: router({
    getSightingLink: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const sighting = await db.getSightingById(input.id);
        if (!sighting) throw new Error("Sighting not found");
        return {
          url: `/sighting/${input.id}`,
          title: `ICE Tracker: ${sighting.licensePlate}`,
          description: `Vehicle sighting reported at ${sighting.locationAddress || `${sighting.latitude}, ${sighting.longitude}`}`,
        };
      }),
    getPlateLinkData: publicProcedure
      .input(z.object({ licensePlate: z.string() }))
      .query(async ({ input }) => {
        const plate = input.licensePlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const sightings = await db.searchSightingsByLicensePlate(plate);
        return {
          url: `/plate/${plate}`,
          title: `ICE Tracker: Plate ${plate}`,
          description: `${sightings.length} sighting(s) reported for vehicle ${plate}`,
        };
      }),
  }),

  // Delta updates - only fetch sightings newer than a given timestamp
  delta: router({
    since: publicProcedure
      .input(z.object({ since: z.string(), limit: z.number().min(1).max(200).optional() }))
      .query(async ({ input }) => {
        const allSightings = await db.getAllSightings({ limit: input.limit ?? 200, hideHidden: true });
        const cutoff = new Date(input.since);
        return allSightings.filter((s: any) => new Date(s.createdAt) > cutoff);
      }),
  }),

  // Proximity alerts - sightings near a location
  proximity: router({
    nearby: publicProcedure
      .input(z.object({
        latitude: z.number(),
        longitude: z.number(),
        radiusKm: z.number().min(0.1).max(50).optional(),
        since: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const nearby = await db.getSightingsNearLocation(
          input.latitude,
          input.longitude,
          input.radiusKm ?? 5
        );
        if (input.since) {
          const cutoff = new Date(input.since);
          return nearby.filter((s: any) => new Date(s.createdAt) > cutoff);
        }
        return nearby;
      }),
  }),

  // Export - CSV and JSON export of plate history
  export: router({
    plateHistory: publicProcedure
      .input(z.object({ licensePlate: z.string(), format: z.enum(["json", "csv"]).optional() }))
      .query(async ({ input }) => {
        const plate = input.licensePlate.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const sightings = await db.searchSightingsByLicensePlate(plate);
        const format = input.format ?? "json";

        if (format === "csv") {
          const header = "id,licensePlate,latitude,longitude,locationAddress,vehicleType,agencyType,vehicleMake,vehicleModel,credibilityScore,upvotes,downvotes,createdAt";
          const rows = sightings.map((s: any) =>
            [
              s.id, s.licensePlate, s.latitude, s.longitude,
              `"${(s.locationAddress || "").replace(/"/g, "'")}"`,
              s.vehicleType || "", (s as any).agencyType || "",
              (s as any).vehicleMake || "", (s as any).vehicleModel || "",
              s.credibilityScore, s.upvotes, s.downvotes,
              new Date(s.createdAt).toISOString(),
            ].join(",")
          );
          return { format: "csv", data: [header, ...rows].join("\n"), count: sightings.length };
        }

        return { format: "json", data: JSON.stringify(sightings, null, 2), count: sightings.length };
      }),

    allSightings: publicProcedure
      .input(z.object({ format: z.enum(["json", "csv"]).optional() }))
      .query(async ({ input }) => {
        const allSightings = await db.getAllSightings({ limit: 1000, hideHidden: true });
        const format = input?.format ?? "json";

        if (format === "csv") {
          const header = "id,licensePlate,latitude,longitude,locationAddress,vehicleType,agencyType,credibilityScore,upvotes,downvotes,createdAt";
          const rows = allSightings.map((s: any) =>
            [
              s.id, s.licensePlate, s.latitude, s.longitude,
              `"${(s.locationAddress || "").replace(/"/g, "'")}"`,
              s.vehicleType || "", (s as any).agencyType || "",
              s.credibilityScore, s.upvotes, s.downvotes,
              new Date(s.createdAt).toISOString(),
            ].join(",")
          );
          return { format: "csv", data: [header, ...rows].join("\n"), count: allSightings.length };
        }

        return { format: "json", data: JSON.stringify(allSightings, null, 2), count: allSightings.length };
      }),
  }),

  // Anomaly detection - flags suspicious patterns
  anomaly: router({
    detect: publicProcedure
      .input(z.object({ windowHours: z.number().min(1).max(72).optional() }).optional())
      .query(async ({ input }) => {
        const windowHours = input?.windowHours ?? 24;
        const allSightings = await db.getAllSightings({ limit: 1000 });
        const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);
        const recent = allSightings.filter((s: any) => new Date(s.createdAt) >= cutoff);

        const anomalies: Array<{
          type: string;
          severity: "low" | "medium" | "high";
          description: string;
          plates: string[];
          sightingIds: number[];
        }> = [];

        // 1. Teleporting vehicle: same plate, >500km in <1 hour
        const byPlate: Record<string, any[]> = {};
        for (const s of recent) {
          if (!byPlate[s.licensePlate]) byPlate[s.licensePlate] = [];
          byPlate[s.licensePlate].push(s);
        }

        const R = 6371;
        const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLon = ((lon2 - lon1) * Math.PI) / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        };

        for (const [plate, plateSightings] of Object.entries(byPlate)) {
          if (plateSightings.length < 2) continue;
          const sorted = plateSightings.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            const distKm = haversine(
              parseFloat(prev.latitude), parseFloat(prev.longitude),
              parseFloat(curr.latitude), parseFloat(curr.longitude)
            );
            const timeDiffHours = (new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime()) / 3600000;
            if (distKm > 200 && timeDiffHours < 1) {
              anomalies.push({
                type: "teleporting_vehicle",
                severity: "high",
                description: `Plate ${plate} moved ${Math.round(distKm)}km in ${Math.round(timeDiffHours * 60)} minutes — likely duplicate or false report`,
                plates: [plate],
                sightingIds: [prev.id, curr.id],
              });
            }
          }
        }

        // 2. Duplicate submission burst: same plate, same location, multiple times in 5 min
        for (const [plate, plateSightings] of Object.entries(byPlate)) {
          if (plateSightings.length < 3) continue;
          const sorted = plateSightings.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          for (let i = 2; i < sorted.length; i++) {
            const window = [sorted[i-2], sorted[i-1], sorted[i]];
            const timeDiff = (new Date(window[2].createdAt).getTime() - new Date(window[0].createdAt).getTime()) / 60000;
            if (timeDiff < 5) {
              const maxDist = Math.max(
                haversine(parseFloat(window[0].latitude), parseFloat(window[0].longitude), parseFloat(window[1].latitude), parseFloat(window[1].longitude)),
                haversine(parseFloat(window[1].latitude), parseFloat(window[1].longitude), parseFloat(window[2].latitude), parseFloat(window[2].longitude))
              );
              if (maxDist < 0.1) {
                anomalies.push({
                  type: "duplicate_burst",
                  severity: "medium",
                  description: `Plate ${plate} reported 3+ times within 5 minutes at the same location — possible spam`,
                  plates: [plate],
                  sightingIds: window.map((s: any) => s.id),
                });
                break;
              }
            }
          }
        }

        // 3. Mass coordinated report: >10 sightings from same location in 1 hour
        const locationBuckets: Record<string, any[]> = {};
        for (const s of recent) {
          const key = `${Math.round(parseFloat(s.latitude) * 100)},${Math.round(parseFloat(s.longitude) * 100)}`;
          if (!locationBuckets[key]) locationBuckets[key] = [];
          locationBuckets[key].push(s);
        }
        for (const [, bucket] of Object.entries(locationBuckets)) {
          if (bucket.length >= 10) {
            const uniquePlates = [...new Set(bucket.map((s: any) => s.licensePlate))];
            if (uniquePlates.length < 3) {
              anomalies.push({
                type: "coordinated_report",
                severity: "high",
                description: `${bucket.length} sightings at the same location with only ${uniquePlates.length} unique plates — possible coordinated false reporting`,
                plates: uniquePlates,
                sightingIds: bucket.map((s: any) => s.id),
              });
            }
          }
        }

        return anomalies.sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.severity] - order[b.severity];
        });
      }),
  }),

  // Recently tracked plates with full details
  recentPlates: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllTrackedPlates(input?.limit ?? 20);
      }),
  }),
});

export type AppRouter = typeof appRouter;
