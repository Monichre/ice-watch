/**
 * useProximityAlerts
 *
 * Monitors for new sightings within a configurable radius of the user's
 * current location and fires browser push notifications when detected.
 */

import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { sendNotification, requestNotificationPermission } from "@/lib/notifications";

type Sighting = {
  id: number;
  licensePlate: string;
  latitude: string;
  longitude: string;
  locationAddress: string | null;
  agencyType?: string | null;
  createdAt: string | Date;
};

type Options = {
  enabled: boolean;
  radiusKm: number;
  userLat: number | null;
  userLng: number | null;
  sightings: Sighting[];
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function useProximityAlerts({ enabled, radiusKm, userLat, userLng, sightings }: Options) {
  const seenIds = useRef<Set<number>>(new Set());
  const permissionGranted = useRef(false);

  // Request permission once when enabled
  useEffect(() => {
    if (!enabled || Platform.OS !== "web") return;
    requestNotificationPermission().then((granted) => {
      permissionGranted.current = granted;
    });
  }, [enabled]);

  const checkProximity = useCallback(() => {
    if (!enabled || userLat === null || userLng === null) return;
    if (Platform.OS !== "web") return;

    for (const s of sightings) {
      if (seenIds.current.has(s.id)) continue;
      seenIds.current.add(s.id);

      const dist = haversineKm(
        userLat,
        userLng,
        parseFloat(s.latitude),
        parseFloat(s.longitude)
      );

      if (dist <= radiusKm) {
        const agency = s.agencyType ? `${s.agencyType} vehicle` : "Vehicle";
        const location = s.locationAddress || `${parseFloat(s.latitude).toFixed(4)}, ${parseFloat(s.longitude).toFixed(4)}`;
        const distLabel = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;

        sendNotification(
          `⚠️ ${agency} nearby — ${s.licensePlate}`,
          `Spotted ${distLabel} from you at ${location}`,
          `proximity-${s.id}`
        );
      }
    }
  }, [enabled, userLat, userLng, radiusKm, sightings]);

  useEffect(() => {
    checkProximity();
  }, [checkProximity]);
}
