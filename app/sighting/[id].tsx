import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, Image, Pressable,
  ActivityIndicator, Alert, StyleSheet, Share,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { getDeviceId } from "@/lib/device-id";
import { LeafletMap } from "@/components/leaflet-map";

const AGENCY_COLORS: Record<string, string> = {
  ICE: "#EF4444", CBP: "#F59E0B", DHS: "#8B5CF6",
  FBI: "#3B82F6", DEA: "#10B981", ATF: "#F97316",
  USMS: "#EC4899", Other: "#6B7280",
};

function getCredColor(score: number) {
  if (score >= 70) return "#22C55E";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}

function getCredLabel(score: number) {
  if (score >= 80) return "High Confidence";
  if (score >= 60) return "Likely Accurate";
  if (score >= 40) return "Unverified";
  return "Disputed";
}

export default function SightingDetailScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const sightingId = parseInt(params.id as string);

  const [deviceId, setDeviceId] = useState<string>("");
  const [userVote, setUserVote] = useState<"upvote" | "downvote" | "flag" | null>(null);

  const { data: sighting, isLoading, refetch } = trpc.sightings.getById.useQuery({ id: sightingId });
  const { data: existingVote } = trpc.votes.getUserVote.useQuery(
    { deviceId, sightingId },
    { enabled: !!deviceId }
  );
  const castVoteMutation = trpc.votes.cast.useMutation();

  useEffect(() => {
    (async () => { setDeviceId(await getDeviceId()); })();
  }, []);

  useEffect(() => {
    if (existingVote) setUserVote(existingVote.voteType);
  }, [existingVote]);

  const handleVote = async (voteType: "upvote" | "downvote" | "flag") => {
    if (!deviceId) return;
    try {
      if (userVote !== voteType) {
        await castVoteMutation.mutateAsync({ deviceId, sightingId, voteType });
        setUserVote(voteType);
      } else {
        setUserVote(null);
      }
      setTimeout(() => refetch(), 500);
    } catch {
      Alert.alert("Error", "Failed to submit vote. Please try again.");
    }
  };

  const handleShare = async () => {
    if (!sighting) return;
    const url = typeof window !== "undefined" ? `${window.location.origin}/sighting/${sightingId}` : "";
    const text = `ICE Tracker: ${sighting.licensePlate} spotted — ${sighting.locationAddress || `${sighting.latitude}, ${sighting.longitude}`}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `ICE Tracker: ${sighting.licensePlate}`, text, url });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        Alert.alert("Link Copied", "Sighting link copied to clipboard!");
      } else {
        Alert.alert("Share Link", url);
      }
    } catch {}
  };

  const handleExportCSV = async () => {
    if (!sighting) return;
    const rows = [
      "id,licensePlate,latitude,longitude,locationAddress,vehicleType,agencyType,vehicleMake,vehicleModel,credibilityScore,upvotes,downvotes,createdAt",
      [
        sighting.id, sighting.licensePlate, sighting.latitude, sighting.longitude,
        `"${(sighting.locationAddress || "").replace(/"/g, "'")}"`,
        sighting.vehicleType || "", (sighting as any).agencyType || "",
        (sighting as any).vehicleMake || "", (sighting as any).vehicleModel || "",
        sighting.credibilityScore, sighting.upvotes, sighting.downvotes,
        new Date(sighting.createdAt).toISOString(),
      ].join(","),
    ].join("\n");
    if (typeof window !== "undefined") {
      const blob = new Blob([rows], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `sighting-${sighting.id}-${sighting.licensePlate}.csv`;
      a.click();
    }
  };

  if (isLoading || !sighting) {
    return (
      <ScreenContainer containerClassName="bg-[#0d0d1a]">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </ScreenContainer>
    );
  }

  const credibility = parseFloat(sighting.credibilityScore as string);
  const totalVotes = sighting.upvotes + sighting.downvotes;
  const latitude = parseFloat(sighting.latitude as string);
  const longitude = parseFloat(sighting.longitude as string);
  const credColor = getCredColor(credibility);
  const agencyColor = (sighting as any).agencyType
    ? (AGENCY_COLORS[(sighting as any).agencyType] || "#6B7280")
    : null;

  // "Confirmed by multiple sources" if upvotes >= 3 and credibility >= 60
  const isConfirmed = sighting.upvotes >= 3 && credibility >= 60;

  return (
    <ScreenContainer containerClassName="bg-[#0d0d1a]">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={styles.backBtn}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Sighting</Text>
          <Pressable onPress={handleShare} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={styles.shareBtn}>Share ↗</Text>
          </Pressable>
        </View>

        {/* ── Photo ── */}
        <View style={{ position: "relative" }}>
          <Image
            source={{ uri: sighting.photoUrl }}
            style={styles.photo}
            resizeMode="cover"
          />
          {/* Agency overlay on photo */}
          {(sighting as any).agencyType && agencyColor && (
            <View style={[styles.photoAgencyBadge, { backgroundColor: agencyColor + "cc" }]}>
              <Text style={styles.photoAgencyText}>{(sighting as any).agencyType}</Text>
            </View>
          )}
          {isConfirmed && (
            <View style={styles.confirmedBadge}>
              <Text style={styles.confirmedText}>✓ CONFIRMED</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>

          {/* ── Plate + vehicle info ── */}
          <View style={styles.plateSection}>
            <Text style={styles.plateText}>{sighting.licensePlate}</Text>
            {(sighting as any).vehicleColor && (sighting as any).vehicleMake && (
              <Text style={styles.vehicleSubtitle}>
                {(sighting as any).vehicleColor} {(sighting as any).vehicleMake}{" "}
                {(sighting as any).vehicleModel || ""}
              </Text>
            )}
            {sighting.vehicleType && !(sighting as any).vehicleMake && (
              <Text style={styles.vehicleSubtitle}>{sighting.vehicleType}</Text>
            )}
          </View>

          {/* ── Credibility panel ── */}
          <View style={[styles.credPanel, { borderColor: credColor + "44" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={styles.credPanelTitle}>Community Credibility</Text>
              <Text style={[styles.credScore, { color: credColor }]}>{credibility.toFixed(0)}%</Text>
            </View>
            {/* Credibility bar */}
            <View style={styles.credBarBg}>
              <View style={[styles.credBarFill, { width: `${credibility}%` as any, backgroundColor: credColor }]} />
            </View>
            <Text style={[styles.credLabel, { color: credColor }]}>{getCredLabel(credibility)}</Text>
            <View style={styles.voteCountRow}>
              <Text style={styles.voteCount}>✓ {sighting.upvotes} verified</Text>
              <Text style={styles.voteCount}>✗ {sighting.downvotes} disputed</Text>
              <Text style={styles.voteCount}>🚩 {sighting.flagCount} flagged</Text>
            </View>
            {isConfirmed && (
              <View style={styles.confirmedPill}>
                <Text style={styles.confirmedPillText}>✓ Confirmed by multiple sources</Text>
              </View>
            )}
          </View>

          {/* ── Voting buttons ── */}
          <View style={styles.voteRow}>
            <Pressable
              onPress={() => handleVote("upvote")}
              style={({ pressed }) => [
                styles.voteBtn,
                userVote === "upvote" && { backgroundColor: "#22C55E", borderColor: "#22C55E" },
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.voteBtnText, userVote === "upvote" && { color: "#fff" }]}>✓ Verified</Text>
            </Pressable>
            <Pressable
              onPress={() => handleVote("downvote")}
              style={({ pressed }) => [
                styles.voteBtn,
                userVote === "downvote" && { backgroundColor: "#EF4444", borderColor: "#EF4444" },
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.voteBtnText, userVote === "downvote" && { color: "#fff" }]}>✗ Inaccurate</Text>
            </Pressable>
            <Pressable
              onPress={() => handleVote("flag")}
              style={({ pressed }) => [
                styles.voteBtnSmall,
                userVote === "flag" && { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.voteBtnText, userVote === "flag" && { color: "#fff" }]}>🚩</Text>
            </Pressable>
          </View>

          {/* ── AI Analysis panel ── */}
          {((sighting as any).agencyType || (sighting as any).agencyMarkings || (sighting as any).badgeNumber || (sighting as any).uniformDescription) && (
            <View style={styles.aiPanel}>
              <Text style={styles.aiPanelTitle}>AI Analysis</Text>
              {(sighting as any).agencyType && agencyColor && (
                <View style={styles.aiRow}>
                  <Text style={styles.aiLabel}>Agency</Text>
                  <View style={[styles.agencyChip, { backgroundColor: agencyColor + "22", borderColor: agencyColor + "66" }]}>
                    <Text style={[styles.agencyChipText, { color: agencyColor }]}>{(sighting as any).agencyType}</Text>
                  </View>
                </View>
              )}
              {(sighting as any).agencyMarkings && (
                <View style={styles.aiRow}>
                  <Text style={styles.aiLabel}>Markings</Text>
                  <Text style={styles.aiValue}>{(sighting as any).agencyMarkings}</Text>
                </View>
              )}
              {(sighting as any).badgeNumber && (
                <View style={styles.aiRow}>
                  <Text style={styles.aiLabel}>Badge #</Text>
                  <Text style={[styles.aiValue, { color: "#F59E0B", fontFamily: "monospace" }]}>{(sighting as any).badgeNumber}</Text>
                </View>
              )}
              {(sighting as any).uniformDescription && (
                <View style={styles.aiRow}>
                  <Text style={styles.aiLabel}>Uniform</Text>
                  <Text style={styles.aiValue}>{(sighting as any).uniformDescription}</Text>
                </View>
              )}
              {(sighting as any).aiConfidence && (
                <View style={styles.aiRow}>
                  <Text style={styles.aiLabel}>AI Confidence</Text>
                  <Text style={styles.aiValue}>{(parseFloat((sighting as any).aiConfidence) * 100).toFixed(0)}%</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Location ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            {sighting.locationAddress && (
              <Text style={styles.addressText}>{sighting.locationAddress}</Text>
            )}
            <Text style={styles.coordsText}>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Text>
            {sighting.locationAccuracy && (
              <Text style={styles.accuracyText}>GPS accuracy: ±{parseFloat(sighting.locationAccuracy as string).toFixed(0)}m</Text>
            )}
            <View style={{ height: 200, borderRadius: 14, overflow: "hidden", marginTop: 10 }}>
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <LeafletMap
                  markers={[{
                    id: sighting.id, latitude, longitude,
                    licensePlate: sighting.licensePlate,
                    vehicleType: sighting.vehicleType,
                    credibilityScore: sighting.credibilityScore as string,
                    upvotes: sighting.upvotes, downvotes: sighting.downvotes,
                    agencyType: (sighting as any).agencyType,
                  }]}
                  center={[latitude, longitude]}
                  zoom={15}
                />
              </div>
            </View>
          </View>

          {/* ── Notes ── */}
          {sighting.notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>{sighting.notes}</Text>
              </View>
            </View>
          )}

          {/* ── Actions ── */}
          <Pressable
            onPress={() => router.push(`/plate/${encodeURIComponent(sighting.licensePlate)}` as any)}
            style={({ pressed }) => [styles.trackBtn, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.trackBtnText}>Track This Plate →</Text>
          </Pressable>

          <Text style={styles.timestamp}>
            Reported {new Date(sighting.createdAt).toLocaleString()}
          </Text>
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
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  shareBtn: { color: "#3B82F6", fontSize: 14, fontWeight: "600" },

  photo: { width: "100%", height: 280, backgroundColor: "#1a1a2e" },
  photoAgencyBadge: {
    position: "absolute", top: 12, left: 12,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
  },
  photoAgencyText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 1 },
  confirmedBadge: {
    position: "absolute", top: 12, right: 12,
    backgroundColor: "rgba(34,197,94,0.9)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  confirmedText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 1 },

  body: { padding: 16, gap: 16 },

  plateSection: { alignItems: "center" },
  plateText: {
    color: "#fff", fontSize: 32, fontWeight: "900",
    fontFamily: "monospace", letterSpacing: 3,
  },
  vehicleSubtitle: { color: "#888", fontSize: 14, marginTop: 4 },

  credPanel: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16, padding: 16,
    borderWidth: 1,
  },
  credPanelTitle: { color: "#aaa", fontSize: 13, fontWeight: "600" },
  credScore: { fontSize: 22, fontWeight: "900" },
  credBarBg: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 6 },
  credBarFill: { height: 6, borderRadius: 3 },
  credLabel: { fontSize: 12, fontWeight: "700", marginBottom: 8 },
  voteCountRow: { flexDirection: "row", gap: 12 },
  voteCount: { color: "#666", fontSize: 12 },
  confirmedPill: {
    marginTop: 10, backgroundColor: "rgba(34,197,94,0.15)",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(34,197,94,0.3)",
    alignSelf: "flex-start",
  },
  confirmedPillText: { color: "#22C55E", fontSize: 12, fontWeight: "700" },

  voteRow: { flexDirection: "row", gap: 8 },
  voteBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  voteBtnSmall: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  voteBtnText: { color: "#ccc", fontWeight: "700", fontSize: 14 },

  aiPanel: {
    backgroundColor: "rgba(59,130,246,0.07)",
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(59,130,246,0.2)",
    gap: 8,
  },
  aiPanelTitle: { color: "#3B82F6", fontSize: 13, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 },
  aiRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  aiLabel: { color: "#666", fontSize: 12, fontWeight: "600", width: 80 },
  aiValue: { color: "#ccc", fontSize: 12, flex: 1 },
  agencyChip: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  agencyChipText: { fontSize: 12, fontWeight: "800", letterSpacing: 1 },

  section: { gap: 6 },
  sectionTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  addressText: { color: "#ccc", fontSize: 14 },
  coordsText: { color: "#666", fontSize: 12, fontFamily: "monospace" },
  accuracyText: { color: "#555", fontSize: 11 },

  notesBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  notesText: { color: "#ccc", fontSize: 14, lineHeight: 20 },

  trackBtn: {
    backgroundColor: "#3B82F6",
    borderRadius: 14, paddingVertical: 14, alignItems: "center",
  },
  trackBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  timestamp: { color: "#444", fontSize: 11, textAlign: "center" },
});
