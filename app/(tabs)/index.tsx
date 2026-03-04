import { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator,
  TextInput, ScrollView, StyleSheet, Switch,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { LeafletMap } from "@/components/leaflet-map";
import { useProximityAlerts } from "@/hooks/use-proximity-alerts";
import {
  getCachedSightings, mergeSightingsCache, getLastFetchTime, setLastFetchTime,
  type CachedSighting,
} from "@/lib/sightings-cache";

const AGENCY_COLORS: Record<string, string> = {
  ICE: "#EF4444",
  CBP: "#F59E0B",
  DHS: "#8B5CF6",
  FBI: "#3B82F6",
  DEA: "#10B981",
  ATF: "#F97316",
  USMS: "#EC4899",
  Other: "#6B7280",
};

type MarkerData = {
  id: number;
  latitude: number;
  longitude: number;
  licensePlate: string;
  vehicleType: string | null;
  credibilityScore: string;
  upvotes: number;
  downvotes: number;
  agencyType?: string | null;
  isRecent?: boolean;
};

export default function MapScreen() {
  const colors = useColors();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [newSightingsCount, setNewSightingsCount] = useState(0);
  const [proximityEnabled, setProximityEnabled] = useState(false);
  const [cachedSightings, setCachedSightings] = useState<CachedSighting[]>([]);
  const lastSightingCountRef = useRef(0);

  const { data: sightings, isLoading, refetch } = trpc.sightings.list.useQuery({
    hideHidden: true,
    limit: 500,
  });

  // Load offline cache on mount for instant rendering
  useEffect(() => {
    getCachedSightings().then((cached) => {
      if (cached.length > 0) setCachedSightings(cached);
    });
  }, []);

  // Merge server data into cache when it arrives
  useEffect(() => {
    if (!sightings || sightings.length === 0) return;
    const normalized = (sightings as any[]).map((s) => ({
      ...s,
      createdAt: typeof s.createdAt === "string" ? s.createdAt : new Date(s.createdAt).toISOString(),
    })) as CachedSighting[];
    mergeSightingsCache(normalized).then(setCachedSightings);
    setLastFetchTime();
  }, [sightings]);

  // Get user location on mount
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => console.warn("Location error:", err)
      );
    }
  }, []);

  // Real-time polling every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => refetch(), 10000);
    return () => clearInterval(interval);
  }, [refetch]);

  // New sightings badge
  useEffect(() => {
    if (!sightings) return;
    const prev = lastSightingCountRef.current;
    if (prev > 0 && sightings.length > prev) {
      setNewSightingsCount(sightings.length - prev);
      setTimeout(() => setNewSightingsCount(0), 6000);
    }
    lastSightingCountRef.current = sightings.length;
  }, [sightings]);

  // Proximity alerts hook
  const activeSightings = (sightings as any[] | undefined) || cachedSightings;
  useProximityAlerts({
    enabled: proximityEnabled,
    radiusKm: 2,
    userLat: userLocation?.latitude ?? null,
    userLng: userLocation?.longitude ?? null,
    sightings: activeSightings,
  });

  // Build markers with isRecent flag
  const now = Date.now();
  const allMarkers: MarkerData[] = useMemo(() =>
    (sightings || []).map((s) => ({
      id: s.id,
      latitude: parseFloat(s.latitude as string),
      longitude: parseFloat(s.longitude as string),
      licensePlate: s.licensePlate,
      vehicleType: s.vehicleType,
      credibilityScore: s.credibilityScore as string,
      upvotes: s.upvotes,
      downvotes: s.downvotes,
      agencyType: (s as any).agencyType ?? null,
      isRecent: now - new Date(s.createdAt).getTime() < 10 * 60 * 1000,
    })),
    [sightings]
  );

  // Filtered markers
  const markers: MarkerData[] = useMemo(() => {
    let result = allMarkers;
    if (selectedAgency) {
      result = result.filter((m) => m.agencyType === selectedAgency);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      result = result.filter((m) => m.licensePlate.includes(q));
    }
    return result;
  }, [allMarkers, selectedAgency, searchQuery]);

  // Unique agencies in data
  const agencies = useMemo(() => {
    const set = new Set<string>();
    allMarkers.forEach((m) => { if (m.agencyType) set.add(m.agencyType); });
    return Array.from(set).sort();
  }, [allMarkers]);

  const mapCenter: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : [37.7749, -122.4194];

  const getCredColor = (score: string) => {
    const n = parseFloat(score);
    if (n >= 70) return "#22C55E";
    if (n >= 40) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-[#0d0d1a]">
      <View style={styles.container}>
        {/* Map fills full screen */}
        {isLoading ? (
          <View style={[styles.container, { alignItems: "center", justifyContent: "center", backgroundColor: "#0d0d1a" }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: "#666", marginTop: 12 }}>Loading map…</Text>
          </View>
        ) : (
          <div style={{ position: "absolute", inset: 0 }}>
            <LeafletMap
              markers={markers}
              center={mapCenter}
              zoom={14}
              onMarkerClick={setSelectedMarker}
              showUserLocation
              userLocation={userLocation}
              showHeatmap={showHeatmap}
            />
          </div>
        )}

        {/* ── Top search bar ── */}
        <View style={styles.topBar}>
          {/* App title pill */}
          <View style={styles.titlePill}>
            <View style={styles.liveDot} />
            <Text style={styles.titleText}>ICE Tracker</Text>
            {newSightingsCount > 0 && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>+{newSightingsCount}</Text>
              </View>
            )}
          </View>

          {/* Search input */}
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search plate…"
              placeholderTextColor="#555"
              style={styles.searchInput}
              autoCapitalize="characters"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <Text style={{ color: "#555", fontSize: 16, paddingHorizontal: 4 }}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Agency filter chips ── */}
        {agencies.length > 0 && (
          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
              <Pressable
                onPress={() => setSelectedAgency(null)}
                style={[styles.chip, !selectedAgency && styles.chipActive]}
              >
                <Text style={[styles.chipText, !selectedAgency && styles.chipTextActive]}>All</Text>
              </Pressable>
              {agencies.map((agency) => {
                const active = selectedAgency === agency;
                const color = AGENCY_COLORS[agency] || "#6B7280";
                return (
                  <Pressable
                    key={agency}
                    onPress={() => setSelectedAgency(active ? null : agency)}
                    style={[styles.chip, active && { backgroundColor: color + "33", borderColor: color }]}
                  >
                    <View style={[styles.chipDot, { backgroundColor: color }]} />
                    <Text style={[styles.chipText, active && { color }]}>{agency}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Map controls (right side) ── */}
        <View style={styles.mapControls}>
          {/* Heatmap toggle */}
          <Pressable
            onPress={() => setShowHeatmap((v) => !v)}
            style={[styles.controlBtn, showHeatmap && styles.controlBtnActive]}
          >
            <Text style={{ fontSize: 18 }}>🔥</Text>
          </Pressable>
          {/* Proximity alerts toggle */}
          <Pressable
            onPress={() => setProximityEnabled((v) => !v)}
            style={[styles.controlBtn, proximityEnabled && styles.controlBtnActive]}
          >
            <Text style={{ fontSize: 18 }}>🚨</Text>
          </Pressable>
          {/* Refresh */}
          <Pressable
            onPress={() => refetch()}
            style={styles.controlBtn}
          >
            <Text style={{ fontSize: 18 }}>↻</Text>
          </Pressable>
          {/* Re-center */}
          {userLocation && (
            <Pressable
              onPress={() => {/* map auto-centers via prop */}}
              style={styles.controlBtn}
            >
              <Text style={{ fontSize: 18 }}>◎</Text>
            </Pressable>
          )}
          {/* Widget link */}
          <Pressable
            onPress={() => {
              if (typeof window !== "undefined") {
                window.open("/widget", "_blank");
              }
            }}
            style={styles.controlBtn}
          >
            <Text style={{ fontSize: 18 }}>📱</Text>
          </Pressable>
        </View>

        {/* ── Stats strip ── */}
        <View style={styles.statsStrip}>
          <Text style={styles.statsText}>
            {markers.length} sighting{markers.length !== 1 ? "s" : ""}
            {selectedAgency ? ` · ${selectedAgency}` : ""}
            {searchQuery ? ` · "${searchQuery}"` : ""}
          </Text>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* ── Selected marker bottom card ── */}
        {selectedMarker && (
          <View style={styles.markerCard}>
            {/* Agency badge */}
            {(selectedMarker as any).agencyType && (
              <View style={[styles.agencyBadge, {
                backgroundColor: (AGENCY_COLORS[(selectedMarker as any).agencyType] || "#6B7280") + "22",
                borderColor: (AGENCY_COLORS[(selectedMarker as any).agencyType] || "#6B7280") + "88",
              }]}>
                <Text style={[styles.agencyBadgeText, { color: AGENCY_COLORS[(selectedMarker as any).agencyType] || "#6B7280" }]}>
                  {(selectedMarker as any).agencyType}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={styles.plateText}>{selectedMarker.licensePlate}</Text>
              <Pressable onPress={() => setSelectedMarker(null)} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <Text style={{ color: "#555", fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>

            {selectedMarker.vehicleType && (
              <Text style={styles.vehicleTypeText}>{selectedMarker.vehicleType}</Text>
            )}

            {/* Credibility bar */}
            <View style={styles.credRow}>
              <View style={styles.credBarBg}>
                <View style={[styles.credBarFill, {
                  width: `${parseFloat(selectedMarker.credibilityScore)}%` as any,
                  backgroundColor: getCredColor(selectedMarker.credibilityScore),
                }]} />
              </View>
              <Text style={[styles.credText, { color: getCredColor(selectedMarker.credibilityScore) }]}>
                {parseFloat(selectedMarker.credibilityScore).toFixed(0)}%
              </Text>
              <Text style={styles.voteText}>{selectedMarker.upvotes + selectedMarker.downvotes} votes</Text>
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => router.push(`/plate/${encodeURIComponent(selectedMarker.licensePlate)}` as any)}
                style={({ pressed }) => [styles.btnOutline, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Track Plate</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/sighting/${selectedMarker.id}` as any)}
                style={({ pressed }) => [styles.btnFill, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={styles.btnFillText}>View Details</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── FAB camera button ── */}
        <Pressable
          onPress={() => router.push("/camera" as any)}
          style={({ pressed }) => [styles.fab, {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          }]}
        >
          <Text style={{ fontSize: 26 }}>📷</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative" },

  // Top bar
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingTop: 12, paddingHorizontal: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
    zIndex: 10,
  },
  titlePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(13,13,26,0.92)",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  titleText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
  newBadge: {
    backgroundColor: "#EF4444", borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1, marginLeft: 4,
  },
  newBadgeText: { color: "white", fontSize: 10, fontWeight: "800" },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(13,13,26,0.92)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    gap: 6,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, fontFamily: "monospace" },

  // Agency filter chips
  filterRow: {
    position: "absolute", top: 60, left: 0, right: 0,
    paddingVertical: 6, zIndex: 10,
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(13,13,26,0.88)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
  },
  chipActive: { backgroundColor: "rgba(59,130,246,0.2)", borderColor: "#3B82F6" },
  chipText: { color: "#aaa", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#3B82F6" },
  chipDot: { width: 6, height: 6, borderRadius: 3 },

  // Map controls
  mapControls: {
    position: "absolute", right: 12, top: 116,
    gap: 10, zIndex: 10,
  },
  controlBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: "rgba(13,13,26,0.92)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  controlBtnActive: {
    backgroundColor: "rgba(239,68,68,0.25)",
    borderColor: "#EF4444",
  },

  // Stats strip
  statsStrip: {
    position: "absolute", bottom: 108, left: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
    zIndex: 10,
  },
  statsText: {
    color: "#aaa", fontSize: 11,
    backgroundColor: "rgba(13,13,26,0.85)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  livePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(34,197,94,0.15)",
    borderWidth: 1, borderColor: "rgba(34,197,94,0.3)",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  liveText: { color: "#22C55E", fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  // Selected marker card
  markerCard: {
    position: "absolute", bottom: 104, left: 12, right: 12,
    backgroundColor: "rgba(20,20,35,0.98)",
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6, shadowRadius: 24, elevation: 16,
    zIndex: 20,
  },
  agencyBadge: {
    alignSelf: "flex-start", borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8,
  },
  agencyBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  plateText: { color: "#fff", fontSize: 24, fontWeight: "900", fontFamily: "monospace", letterSpacing: 2 },
  vehicleTypeText: { color: "#888", fontSize: 13, marginBottom: 8 },
  credRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  credBarBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)" },
  credBarFill: { height: 4, borderRadius: 2 },
  credText: { fontSize: 12, fontWeight: "700" },
  voteText: { color: "#555", fontSize: 11 },

  // Buttons
  btnOutline: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
  },
  btnOutlineText: { fontWeight: "700", fontSize: 14 },
  btnFill: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  btnFillText: { color: "white", fontWeight: "700", fontSize: 14 },

  // FAB — sits above tab bar with comfortable clearance
  fab: {
    position: "absolute", bottom: 96, right: 20,
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#3B82F6", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 14, elevation: 10,
    zIndex: 20,
  },
});
