import { queryGeneric } from "convex/server";
import { v } from "convex/values";
import { haversineKm } from "./_utils";

type Anomaly = {
  type: string;
  severity: "low" | "medium" | "high";
  description: string;
  plates: string[];
  sightingIds: number[];
};

export const detect = queryGeneric({
  args: {
    nowMs: v.number(),
    windowHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const windowHours = Math.min(Math.max(args.windowHours ?? 24, 1), 72);
    const cutoff = args.nowMs - windowHours * 60 * 60 * 1000;
    const rows = await ctx.db.query("sightings").withIndex("by_createdAt").order("desc").take(1500);
    const recent = rows.filter((row) => row.createdAt >= cutoff);
    const anomalies: Anomaly[] = [];

    const byPlate = new Map<string, typeof recent>();
    for (const row of recent) {
      const group = byPlate.get(row.normalizedPlate);
      if (group) {
        group.push(row);
      } else {
        byPlate.set(row.normalizedPlate, [row]);
      }
    }

    for (const [plate, plateRows] of byPlate.entries()) {
      if (plateRows.length < 2) continue;
      const sorted = [...plateRows].sort((a, b) => a.createdAt - b.createdAt);
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        const dist = haversineKm(
          Number.parseFloat(prev.latitude),
          Number.parseFloat(prev.longitude),
          Number.parseFloat(curr.latitude),
          Number.parseFloat(curr.longitude),
        );
        const hours = (curr.createdAt - prev.createdAt) / (1000 * 60 * 60);
        if (dist > 200 && hours < 1) {
          anomalies.push({
            type: "teleporting_vehicle",
            severity: "high",
            description: `Plate ${plate} moved ${Math.round(dist)}km in ${Math.round(hours * 60)} minutes`,
            plates: [plate],
            sightingIds: [prev.id, curr.id],
          });
        }
      }
    }

    for (const [plate, plateRows] of byPlate.entries()) {
      if (plateRows.length < 3) continue;
      const sorted = [...plateRows].sort((a, b) => a.createdAt - b.createdAt);
      for (let i = 2; i < sorted.length; i += 1) {
        const spanStart = sorted[i - 2];
        const spanEnd = sorted[i];
        const minutes = (spanEnd.createdAt - spanStart.createdAt) / (1000 * 60);
        if (minutes >= 5) continue;

        const d1 = haversineKm(
          Number.parseFloat(sorted[i - 2].latitude),
          Number.parseFloat(sorted[i - 2].longitude),
          Number.parseFloat(sorted[i - 1].latitude),
          Number.parseFloat(sorted[i - 1].longitude),
        );
        const d2 = haversineKm(
          Number.parseFloat(sorted[i - 1].latitude),
          Number.parseFloat(sorted[i - 1].longitude),
          Number.parseFloat(sorted[i].latitude),
          Number.parseFloat(sorted[i].longitude),
        );
        if (Math.max(d1, d2) < 0.1) {
          anomalies.push({
            type: "duplicate_burst",
            severity: "medium",
            description: `Plate ${plate} reported repeatedly within five minutes in one location`,
            plates: [plate],
            sightingIds: [sorted[i - 2].id, sorted[i - 1].id, sorted[i].id],
          });
          break;
        }
      }
    }

    const byLocation = new Map<string, typeof recent>();
    for (const row of recent) {
      const key = `${Math.round(Number.parseFloat(row.latitude) * 100)},${Math.round(
        Number.parseFloat(row.longitude) * 100,
      )}`;
      const group = byLocation.get(key);
      if (group) {
        group.push(row);
      } else {
        byLocation.set(key, [row]);
      }
    }

    for (const group of byLocation.values()) {
      if (group.length < 10) continue;
      const uniquePlates = Array.from(new Set(group.map((item) => item.normalizedPlate)));
      if (uniquePlates.length < 3) {
        anomalies.push({
          type: "coordinated_report",
          severity: "high",
          description: `${group.length} sightings reported from a tight area with ${uniquePlates.length} unique plates`,
          plates: uniquePlates,
          sightingIds: group.map((item) => item.id),
        });
      }
    }

    const severityOrder: Record<Anomaly["severity"], number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    return anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  },
});
