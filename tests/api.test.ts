import { describe, expect, it } from "vitest";
import * as db from "../server/db";

const hasConvexDeployment = Boolean(process.env.CONVEX_URL || process.env.EXPO_PUBLIC_CONVEX_URL);
const describeIfConfigured = hasConvexDeployment ? describe : describe.skip;

describeIfConfigured("Vehicle Tracker API", () => {
  let testSightingId: number;
  const testDeviceId = "test-device-12345";

  describe("Sightings", () => {
    it("should create a new sighting", async () => {
      const sightingData = {
        licensePlate: "ABC123",
        vehicleType: "SUV",
        photoUrl: "https://example.com/photo.jpg",
        latitude: "37.7749",
        longitude: "-122.4194",
        locationAccuracy: "10",
        locationAddress: "San Francisco, CA",
        notes: "Test sighting",
        photoMetadata: JSON.stringify({ camera: "iPhone" }),
        deviceId: testDeviceId,
      };

      testSightingId = await db.createSighting(sightingData);
      expect(testSightingId).toBeGreaterThan(0);
    });

    it("should retrieve a sighting by ID", async () => {
      const sighting = await db.getSightingById(testSightingId);
      expect(sighting).toBeDefined();
      expect(sighting?.licensePlate).toBe("ABC123");
      expect(sighting?.vehicleType).toBe("SUV");
    });

    it("should retrieve all sightings", async () => {
      const sightings = await db.getAllSightings({ limit: 10 });
      expect(Array.isArray(sightings)).toBe(true);
      expect(sightings.length).toBeGreaterThan(0);
    });

    it("should search sightings by license plate", async () => {
      const results = await db.searchSightingsByLicensePlate("ABC");
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].licensePlate).toContain("ABC");
    });
  });

  describe("Voting System", () => {
    it("should cast an upvote", async () => {
      await db.castVote({
        deviceId: testDeviceId,
        sightingId: testSightingId,
        voteType: "upvote",
      });

      const vote = await db.getUserVote(testDeviceId, testSightingId);
      expect(vote).toBeDefined();
      expect(vote?.voteType).toBe("upvote");
    });

    it("should update vote counts on sighting", async () => {
      const sighting = await db.getSightingById(testSightingId);
      expect(sighting?.upvotes).toBeGreaterThan(0);
    });

    it("should calculate credibility score", async () => {
      const sighting = await db.getSightingById(testSightingId);
      const credibility = parseFloat(sighting?.credibilityScore as string);
      expect(credibility).toBeGreaterThanOrEqual(0);
      expect(credibility).toBeLessThanOrEqual(100);
    });

    it("should change vote from upvote to downvote", async () => {
      await db.castVote({
        deviceId: testDeviceId,
        sightingId: testSightingId,
        voteType: "downvote",
      });

      const vote = await db.getUserVote(testDeviceId, testSightingId);
      expect(vote?.voteType).toBe("downvote");
    });

    it("should get vote counts", async () => {
      const counts = await db.getVoteCounts(testSightingId);
      expect(counts).toBeDefined();
      expect(typeof counts.upvotes).toBe("number");
      expect(typeof counts.downvotes).toBe("number");
      expect(typeof counts.flagCount).toBe("number");
    });
  });

  describe("Credibility System", () => {
    it("should hide sightings with low credibility", async () => {
      // Cast multiple downvotes to lower credibility
      await db.castVote({
        deviceId: "device-2",
        sightingId: testSightingId,
        voteType: "downvote",
      });
      await db.castVote({
        deviceId: "device-3",
        sightingId: testSightingId,
        voteType: "downvote",
      });
      await db.castVote({
        deviceId: "device-4",
        sightingId: testSightingId,
        voteType: "downvote",
      });
      await db.castVote({
        deviceId: "device-5",
        sightingId: testSightingId,
        voteType: "downvote",
      });

      const sighting = await db.getSightingById(testSightingId);
      const credibility = parseFloat(sighting?.credibilityScore as string);

      // Should be hidden if credibility < 40% and has >= 5 votes
      if (credibility < 40 && (sighting?.upvotes || 0) + (sighting?.downvotes || 0) >= 5) {
        expect(sighting?.isHidden).toBe(true);
      }
    });

    it("should filter out hidden sightings", async () => {
      const visibleSightings = await db.getAllSightings({ hideHidden: true });
      const allSightings = await db.getAllSightings({ hideHidden: false });

      expect(visibleSightings.length).toBeLessThanOrEqual(allSightings.length);
    });
  });

  describe("Location Features", () => {
    it("should find nearby sightings", async () => {
      // San Francisco coordinates
      const nearby = await db.getSightingsNearLocation(37.7749, -122.4194, 10);
      expect(Array.isArray(nearby)).toBe(true);
    });
  });
});
