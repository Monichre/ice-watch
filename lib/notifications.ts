/**
 * Browser Push Notifications + Watched Plates
 * Stores watched plates in localStorage and uses browser Notification API.
 */

const WATCHED_KEY = "icetracker_watched_plates";
const PROXIMITY_KEY = "icetracker_proximity_km";

// ── Watched plates ──────────────────────────────────────────────────────────

export function getWatchedPlates(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(WATCHED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function watchPlate(plate: string): void {
  if (typeof window === "undefined") return;
  const plates = getWatchedPlates();
  const normalized = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!plates.includes(normalized)) {
    plates.push(normalized);
    localStorage.setItem(WATCHED_KEY, JSON.stringify(plates));
  }
}

export function unwatchPlate(plate: string): void {
  if (typeof window === "undefined") return;
  const normalized = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const plates = getWatchedPlates().filter((p) => p !== normalized);
  localStorage.setItem(WATCHED_KEY, JSON.stringify(plates));
}

export function isWatching(plate: string): boolean {
  const normalized = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return getWatchedPlates().includes(normalized);
}

// ── Proximity radius ────────────────────────────────────────────────────────

export function getProximityKm(): number {
  if (typeof window === "undefined") return 5;
  return parseFloat(localStorage.getItem(PROXIMITY_KEY) || "5");
}

export function setProximityKm(km: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROXIMITY_KEY, km.toString());
}

// ── Browser notifications ───────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendNotification(title: string, body: string, tag?: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      tag,
      icon: "/favicon.png",
      badge: "/favicon.png",
    });
  } catch {}
}

// ── Seen sightings tracker (avoid duplicate notifications) ──────────────────

const SEEN_KEY = "icetracker_seen_sightings";

export function markSeen(sightingId: number): void {
  if (typeof window === "undefined") return;
  try {
    const seen: number[] = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    if (!seen.includes(sightingId)) {
      seen.push(sightingId);
      // Keep last 500 only
      if (seen.length > 500) seen.splice(0, seen.length - 500);
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    }
  } catch {}
}

export function hasSeen(sightingId: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const seen: number[] = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return seen.includes(sightingId);
  } catch {
    return false;
  }
}

// ── Distance helper ─────────────────────────────────────────────────────────

export function distanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
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
