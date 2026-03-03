import { useState, useMemo, useEffect } from "react";
import {
  View, Text, ScrollView, Image, Pressable,
  ActivityIndicator, StyleSheet, Share,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { LeafletMap } from "@/components/leaflet-map";
import {
  isWatching, watchPlate, unwatchPlate,
  requestNotificationPermission, sendNotification,
  hasSeen, markSeen,
} from "@/lib/notifications";

const AGENCY_COLORS: Record<string, string> = {
  ICE: "#EF4444", CBP: "#F59E0B", DHS: "#8B5CF6",
  FBI: "#3B82F6", DEA: "#10B981", ATF: "#F97316",
  USMS: "#EC4899", Other: "#6B7280",
};

type Sighting = {
  id: number;
  latitude: string;
  longitude: string;
  licensePlate: string;
  vehicleType: string | null;
  credibilityScore: string;
  upvotes: number;
  downvotes: number;
  photoUrl: string;
  createdAt: Date;
  locationAddress: string | null;
  agencyType?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  badgeNumber?: string | null;
};

function getCredColor(score: number): string {
  if (score >= 70) return "#22C55E";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function calcBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function bearingToArrow(bearing: number): string {
  const dirs = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  return dirs[Math.round(bearing / 45) % 8];
}

function calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export default function PlateTrackingScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const licensePlate = (params.licensePlate as string) || "";
  const [showMap, setShowMap] = useState(true);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    setWatching(isWatching(licensePlate));
  }, [licensePlate]);

  const handleToggleWatch = async () => {
    if (watching) {
      unwatchPlate(licensePlate);
      setWatching(false);
    } else {
      const granted = await requestNotificationPermission();
      watchPlate(licensePlate);
      setWatching(true);
      if (granted) {
        sendNotification(
          `Watching ${licensePlate}`,
          "You'll be notified when this vehicle is spotted.",
          `watch-${licensePlate}`
        );
      }
    }
  };

  const { data: sightings, isLoading, refetch } = trpc.plates.getByPlate.useQuery({ licensePlate });

  const typedSightings: Sighting[] = (sightings as Sighting[]) || [];

  // Sort oldest → newest for timeline
  const sorted = useMemo(() =>
    [...typedSightings].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [typedSightings]
  );

  const markers = sorted.map((s) => ({
    id: s.id,
    latitude: parseFloat(s.latitude),
    longitude: parseFloat(s.longitude),
    licensePlate: s.licensePlate,
    vehicleType: s.vehicleType,
    credibilityScore: s.credibilityScore,
    upvotes: s.upvotes,
    downvotes: s.downvotes,
    agencyType: s.agencyType,
  }));

  const centerLat = markers.length
    ? markers.reduce((s, m) => s + m.latitude, 0) / markers.length
    : 37.7749;
  const centerLng = markers.length
    ? markers.reduce((s, m) => s + m.longitude, 0) / markers.length
    : -122.4194;

  // Total distance traveled
  const totalDistKm = useMemo(() => {
    let d = 0;
    for (let i = 1; i < sorted.length; i++) {
      d += calcDistanceKm(
        parseFloat(sorted[i - 1].latitude), parseFloat(sorted[i - 1].longitude),
        parseFloat(sorted[i].latitude), parseFloat(sorted[i].longitude)
      );
    }
    return d;
  }, [sorted]);

  // Dominant agency
  const dominantAgency = useMemo(() => {
    const counts: Record<string, number> = {};
    sorted.forEach((s) => { if (s.agencyType) counts[s.agencyType] = (counts[s.agencyType] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [sorted]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Tracking plate ${licensePlate} — ${sorted.length} sightings. View on ICE Tracker.`,
        url: typeof window !== "undefined" ? window.location.href : "",
      });
    } catch {}
  };

  if (isLoading) {
    return (
      <ScreenContainer containerClassName="bg-[#0d0d1a]">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-[#0d0d1a]">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={styles.backBtn}>← Back</Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Pressable
              onPress={handleToggleWatch}
              style={({ pressed }) => [styles.watchBtn, watching && styles.watchBtnActive, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={[styles.watchBtnText, watching && styles.watchBtnTextActive]}>
                {watching ? "🔔 Watching" : "🔕 Watch"}
              </Text>
            </Pressable>
            <Pressable onPress={handleShare} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Text style={styles.shareBtn}>Share ↗</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Plate hero ── */}
        <View style={styles.hero}>
          {dominantAgency && (
            <View style={[styles.agencyBadge, {
              backgroundColor: (AGENCY_COLORS[dominantAgency] || "#6B7280") + "22",
              borderColor: (AGENCY_COLORS[dominantAgency] || "#6B7280") + "66",
            }]}>
              <Text style={[styles.agencyText, { color: AGENCY_COLORS[dominantAgency] || "#6B7280" }]}>
                {dominantAgency}
              </Text>
            </View>
          )}
          <Text style={styles.plateHero}>{licensePlate}</Text>
          {sorted[0]?.vehicleColor && sorted[0]?.vehicleMake && (
            <Text style={styles.vehicleSubtitle}>
              {sorted[0].vehicleColor} {sorted[0].vehicleMake} {sorted[0].vehicleModel || ""}
            </Text>
          )}
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{sorted.length}</Text>
            <Text style={styles.statLabel}>Sightings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalDistKm.toFixed(1)} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {sorted.length > 0 ? timeAgo(sorted[sorted.length - 1].createdAt) : "—"}
            </Text>
            <Text style={styles.statLabel}>Last seen</Text>
          </View>
        </View>

        {/* ── Map toggle ── */}
        <Pressable
          onPress={() => setShowMap((v) => !v)}
          style={({ pressed }) => [styles.mapToggle, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={styles.mapToggleText}>{showMap ? "▲ Hide map" : "▼ Show map"}</Text>
        </Pressable>

        {/* ── Map ── */}
        {showMap && markers.length > 0 && (
          <View style={{ height: 260, marginHorizontal: 12, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <LeafletMap
                markers={markers}
                center={[centerLat, centerLng]}
                zoom={12}
                onMarkerClick={(m) => router.push(`/sighting/${m.id}` as any)}
              />
            </div>
          </View>
        )}

        {/* ── Timeline ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Movement Timeline</Text>

          {sorted.length === 0 && (
            <Text style={{ color: "#555", textAlign: "center", marginTop: 20 }}>No sightings recorded yet.</Text>
          )}

          {sorted.map((sighting, index) => {
            const cred = parseFloat(sighting.credibilityScore);
            const credColor = getCredColor(cred);
            const isLast = index === sorted.length - 1;
            const isFirst = index === 0;

            // Direction arrow to next sighting
            let dirArrow = "";
            let distLabel = "";
            if (!isLast) {
              const next = sorted[index + 1];
              const bearing = calcBearing(
                parseFloat(sighting.latitude), parseFloat(sighting.longitude),
                parseFloat(next.latitude), parseFloat(next.longitude)
              );
              dirArrow = bearingToArrow(bearing);
              const dist = calcDistanceKm(
                parseFloat(sighting.latitude), parseFloat(sighting.longitude),
                parseFloat(next.latitude), parseFloat(next.longitude)
              );
              distLabel = dist < 1 ? `${(dist * 1000).toFixed(0)}m` : `${dist.toFixed(1)}km`;
            }

            return (
              <View key={sighting.id}>
                <Pressable
                  onPress={() => router.push(`/sighting/${sighting.id}` as any)}
                  style={({ pressed }) => [styles.timelineCard, { opacity: pressed ? 0.85 : 1 }]}
                >
                  {/* Timeline dot & line */}
                  <View style={styles.timelineDotCol}>
                    <View style={[styles.timelineDot, {
                      backgroundColor: credColor,
                      boxShadow: `0 0 8px ${credColor}88`,
                    } as any]} />
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>

                  {/* Content */}
                  <View style={styles.timelineContent}>
                    {/* Top row: index + time */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.sightingIndex}>#{index + 1}</Text>
                        {isFirst && <View style={styles.firstBadge}><Text style={styles.firstBadgeText}>FIRST</Text></View>}
                        {isLast && <View style={styles.latestBadge}><Text style={styles.latestBadgeText}>LATEST</Text></View>}
                      </View>
                      <Text style={styles.timeAgoText}>{timeAgo(sighting.createdAt)}</Text>
                    </View>

                    {/* Photo + info */}
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Image
                        source={{ uri: sighting.photoUrl }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                      />
                      <View style={{ flex: 1, gap: 4 }}>
                        {sighting.locationAddress ? (
                          <Text style={styles.addressText} numberOfLines={2}>{sighting.locationAddress}</Text>
                        ) : (
                          <Text style={styles.coordsText}>
                            {parseFloat(sighting.latitude).toFixed(4)}, {parseFloat(sighting.longitude).toFixed(4)}
                          </Text>
                        )}
                        {sighting.vehicleType && (
                          <Text style={styles.vehicleTypeText}>{sighting.vehicleType}</Text>
                        )}
                        {sighting.badgeNumber && (
                          <Text style={styles.badgeText}>Badge: {sighting.badgeNumber}</Text>
                        )}
                        {/* Credibility bar */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <View style={styles.credBarBg}>
                            <View style={[styles.credBarFill, { width: `${cred}%` as any, backgroundColor: credColor }]} />
                          </View>
                          <Text style={[styles.credPct, { color: credColor }]}>{cred.toFixed(0)}%</Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.fullDateText}>
                      {new Date(sighting.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </Pressable>

                {/* Movement connector between sightings */}
                {!isLast && (
                  <View style={styles.movementConnector}>
                    <Text style={styles.movementArrow}>{dirArrow}</Text>
                    <Text style={styles.movementDist}>{distLabel}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
  },
  backBtn: { color: "#3B82F6", fontSize: 15, fontWeight: "600" },
  shareBtn: { color: "#3B82F6", fontSize: 14, fontWeight: "600" },

  hero: { alignItems: "center", paddingVertical: 20, paddingHorizontal: 16 },
  agencyBadge: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10,
  },
  agencyText: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  plateHero: {
    color: "#fff", fontSize: 36, fontWeight: "900",
    fontFamily: "monospace", letterSpacing: 4,
  },
  vehicleSubtitle: { color: "#888", fontSize: 14, marginTop: 4 },

  statsRow: {
    flexDirection: "row", gap: 8, paddingHorizontal: 12, marginBottom: 12,
  },
  statCard: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12, padding: 12, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  statValue: { color: "#fff", fontSize: 16, fontWeight: "800" },
  statLabel: { color: "#666", fontSize: 11, marginTop: 2 },

  mapToggle: {
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10, paddingVertical: 8, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  mapToggleText: { color: "#888", fontSize: 13 },

  section: { paddingHorizontal: 12 },
  sectionTitle: {
    color: "#fff", fontSize: 16, fontWeight: "800",
    marginBottom: 16, letterSpacing: 0.5,
  },

  timelineCard: {
    flexDirection: "row", gap: 0,
  },
  timelineDotCol: {
    width: 28, alignItems: "center",
  },
  timelineDot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.2)",
    marginTop: 6,
  },
  timelineLine: {
    flex: 1, width: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginTop: 4, marginBottom: 0,
    minHeight: 40,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14, padding: 12, marginBottom: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    marginLeft: 4,
  },
  sightingIndex: { color: "#fff", fontWeight: "800", fontSize: 14 },
  firstBadge: {
    backgroundColor: "rgba(59,130,246,0.2)", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  firstBadgeText: { color: "#3B82F6", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  latestBadge: {
    backgroundColor: "rgba(34,197,94,0.2)", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  latestBadgeText: { color: "#22C55E", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  timeAgoText: { color: "#666", fontSize: 12 },
  thumbnail: {
    width: 72, height: 72, borderRadius: 10,
    backgroundColor: "#1a1a2e",
  },
  addressText: { color: "#ccc", fontSize: 12, lineHeight: 17 },
  coordsText: { color: "#888", fontSize: 11, fontFamily: "monospace" },
  vehicleTypeText: { color: "#888", fontSize: 11 },
  badgeText: { color: "#F59E0B", fontSize: 11, fontWeight: "600" },
  credBarBg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)" },
  credBarFill: { height: 3, borderRadius: 2 },
  credPct: { fontSize: 11, fontWeight: "700" },
  fullDateText: { color: "#444", fontSize: 10, marginTop: 6 },

  movementConnector: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingLeft: 32, paddingVertical: 4,
  },
  movementArrow: { color: "#3B82F6", fontSize: 18, fontWeight: "800" },
  movementDist: { color: "#555", fontSize: 11 },
  watchBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  watchBtnActive: {
    backgroundColor: "rgba(34,197,94,0.15)",
    borderColor: "rgba(34,197,94,0.4)",
  },
  watchBtnText: { color: "#aaa", fontSize: 12, fontWeight: "700" },
  watchBtnTextActive: { color: "#22C55E" },
});
