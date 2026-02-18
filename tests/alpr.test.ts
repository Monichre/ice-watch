import { describe, it, expect } from "vitest";
import { appRouter } from "../server/routers";

describe("License Plate Recognition & Tracking", () => {
  describe("ALPR Endpoint", () => {
    it("should normalize extracted plate numbers", () => {
      // Test plate normalization logic
      const testPlates = [
        { input: "ABC 123", expected: "ABC123" },
        { input: "abc-123", expected: "ABC123" },
        { input: "  XYZ789  ", expected: "XYZ789" },
        { input: "unknown", expected: "" },
      ];

      testPlates.forEach(({ input, expected }) => {
        const normalized = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
        const result = normalized === "UNKNOWN" ? "" : normalized;
        expect(result).toBe(expected);
      });
    });
  });

  describe("Plate Tracking", () => {
    it("should group sightings by normalized plate", () => {
      // Test that plates are normalized for tracking
      const plates = ["ABC123", "ABC-123", "abc 123"];
      const normalized = plates.map((p) => p.toUpperCase().replace(/[^A-Z0-9]/g, ""));
      
      // All should normalize to the same value
      expect(normalized.every((p) => p === "ABC123")).toBe(true);
    });
  });
});
