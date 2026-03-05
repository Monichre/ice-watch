import { v } from "convex/values";
import { query } from "./_generated/server";

export const detect = query({
  args: { windowHours: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const windowHours = args.windowHours ?? 24;
    const allSightings = await ctx.db.query("sightings").order("desc").take(1000);
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    const recent = allSightings.filter((s) => s._creationTime >= cutoff);

    const anomalies: Array<{
      type: string;
      severity: "low" | "medium" | "high";
      description: string;
      plates: string[];
      sightingIds: any[];
    }> = [];

    // 1. Teleporting vehicle
    const byPlate: Record<string, any[]> = {};
    for (const s of recent) {
      if (!byPlate[s.licensePlate]) byPlate[s.licensePlate] = [];
      byPlate[s.licensePlate].push(s);
    }

    const R = 6371;
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    for (const [plate, plateSightings] of Object.entries(byPlate)) {
      if (plateSightings.length < 2) continue;
      const sorted = plateSightings.sort((a, b) => a._creationTime - b._creationTime);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const distKm = haversine(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
        const timeDiffHours = (curr._creationTime - prev._creationTime) / 3600000;
        
        if (distKm > 200 && timeDiffHours < 1) {
          anomalies.push({
            type: "teleporting_vehicle",
            severity: "high",
            description: `Plate ${plate} moved ${Math.round(distKm)}km in ${Math.round(
              timeDiffHours * 60
            )} minutes — likely duplicate or false report`,
            plates: [plate],
            sightingIds: [prev._id, curr._id],
          });
        }
      }
    }

    // 2. Duplicate submission burst
    for (const [plate, plateSightings] of Object.entries(byPlate)) {
      if (plateSightings.length < 3) continue;
      const sorted = plateSightings.sort((a, b) => a._creationTime - b._creationTime);
      for (let i = 2; i < sorted.length; i++) {
        const window = [sorted[i - 2], sorted[i - 1], sorted[i]];
        const timeDiff = (window[2]._creationTime - window[0]._creationTime) / 60000;
        if (timeDiff < 5) {
          const maxDist = Math.max(
            haversine(window[0].latitude, window[0].longitude, window[1].latitude, window[1].longitude),
            haversine(window[1].latitude, window[1].longitude, window[2].latitude, window[2].longitude)
          );
          if (maxDist < 0.1) {
            anomalies.push({
              type: "duplicate_burst",
              severity: "medium",
              description: `Plate ${plate} reported 3+ times within 5 minutes at the same location — possible spam`,
              plates: [plate],
              sightingIds: window.map((s) => s._id),
            });
            break;
          }
        }
      }
    }

    return anomalies.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });
  },
});
