/**
 * Sightings offline cache + delta-sync utility.
 *
 * Stores the last-fetched sightings in AsyncStorage so the map can render
 * immediately on load, then fetches only new records (delta) from the server.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "sightings_cache_v1";
const LAST_FETCH_KEY = "sightings_last_fetch_v1";

export type CachedSighting = {
  id: number;
  licensePlate: string;
  latitude: string;
  longitude: string;
  locationAddress: string | null;
  vehicleType: string | null;
  agencyType?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  credibilityScore: string;
  upvotes: number;
  downvotes: number;
  photoUrl: string;
  createdAt: string;
};

/** Read cached sightings from AsyncStorage (returns [] if none). */
export async function getCachedSightings(): Promise<CachedSighting[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CachedSighting[];
  } catch {
    return [];
  }
}

/** Write sightings to cache, merging with existing data (dedup by id). */
export async function mergeSightingsCache(newSightings: CachedSighting[]): Promise<CachedSighting[]> {
  try {
    const existing = await getCachedSightings();
    const map = new Map<number, CachedSighting>();
    for (const s of existing) map.set(s.id, s);
    for (const s of newSightings) map.set(s.id, s);
    // Keep the 500 most recent
    const merged = Array.from(map.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 500);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return newSightings;
  }
}

/** Get the ISO timestamp of the last successful fetch. */
export async function getLastFetchTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_FETCH_KEY);
  } catch {
    return null;
  }
}

/** Update the last-fetch timestamp to now. */
export async function setLastFetchTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_FETCH_KEY, new Date().toISOString());
  } catch {}
}

/** Clear the entire cache (useful for debugging). */
export async function clearSightingsCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(LAST_FETCH_KEY);
  } catch {}
}
