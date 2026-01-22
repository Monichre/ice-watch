import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { getDeviceId } from "@/lib/device-id";

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
    (async () => {
      const id = await getDeviceId();
      setDeviceId(id);
    })();
  }, []);

  useEffect(() => {
    if (existingVote) {
      setUserVote(existingVote.voteType);
    }
  }, [existingVote]);

  const handleVote = async (voteType: "upvote" | "downvote" | "flag") => {
    if (!deviceId) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      // Toggle vote if clicking same button
      if (userVote === voteType) {
        // Remove vote (not implemented in backend yet, so just update locally)
        setUserVote(null);
      } else {
        await castVoteMutation.mutateAsync({
          deviceId,
          sightingId,
          voteType,
        });
        setUserVote(voteType);
      }

      // Refetch to get updated counts
      setTimeout(() => refetch(), 500);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Vote error:", error);
      Alert.alert("Error", "Failed to submit vote. Please try again.");
    }
  };

  const handleBack = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  if (isLoading || !sighting) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const credibility = parseFloat(sighting.credibilityScore as string);
  const totalVotes = sighting.upvotes + sighting.downvotes;
  const latitude = parseFloat(sighting.latitude as string);
  const longitude = parseFloat(sighting.longitude as string);

  const getCredibilityColor = (score: number): string => {
    if (score >= 70) return "#22C55E";
    if (score >= 40) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Pressable
            onPress={handleBack}
            style={(state) => ({ opacity: state.pressed ? 0.6 : 1 })}
          >
            <IconSymbol name="chevron.left" size={28} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">Sighting Details</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Photo */}
        <Image
          source={{ uri: sighting.photoUrl }}
          style={{
            width: "100%",
            height: 300,
            backgroundColor: colors.surface,
          }}
          resizeMode="cover"
        />

        <View className="p-4 gap-6">
          {/* License Plate */}
          <View>
            <Text className="text-3xl font-bold text-foreground font-mono text-center">
              {sighting.licensePlate}
            </Text>
            {sighting.vehicleType && (
              <Text className="text-center text-muted mt-2">{sighting.vehicleType}</Text>
            )}
          </View>

          {/* Credibility Score */}
          <View className="items-center">
            <View
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 16,
                backgroundColor: getCredibilityColor(credibility) + "20",
              }}
            >
              <Text
                style={{
                  color: getCredibilityColor(credibility),
                  fontWeight: "700",
                  fontSize: 18,
                }}
              >
                {credibility.toFixed(0)}% Verified
              </Text>
            </View>
            <Text className="text-xs text-muted mt-2">
              {sighting.upvotes} upvotes • {sighting.downvotes} downvotes • {totalVotes} total
            </Text>
          </View>

          {/* Voting Buttons */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => handleVote("upvote")}
              style={(state) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: userVote === "upvote" ? "#22C55E" : colors.surface,
                borderWidth: 2,
                borderColor: userVote === "upvote" ? "#22C55E" : colors.border,
                alignItems: "center",
                opacity: state.pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: userVote === "upvote" ? "white" : colors.foreground,
                  fontWeight: "600",
                }}
              >
                ✓ Verified
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleVote("downvote")}
              style={(state) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: userVote === "downvote" ? "#EF4444" : colors.surface,
                borderWidth: 2,
                borderColor: userVote === "downvote" ? "#EF4444" : colors.border,
                alignItems: "center",
                opacity: state.pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: userVote === "downvote" ? "white" : colors.foreground,
                  fontWeight: "600",
                }}
              >
                ✗ Inaccurate
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleVote("flag")}
              style={(state) => ({
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: userVote === "flag" ? "#F59E0B" : colors.surface,
                borderWidth: 2,
                borderColor: userVote === "flag" ? "#F59E0B" : colors.border,
                alignItems: "center",
                opacity: state.pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: userVote === "flag" ? "white" : colors.foreground,
                  fontWeight: "600",
                }}
              >
                🚩 Flag
              </Text>
            </Pressable>
          </View>

          {/* Location */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Location</Text>
            {sighting.locationAddress && (
              <Text className="text-foreground">{sighting.locationAddress}</Text>
            )}
            <Text className="text-xs text-muted">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </Text>
            {sighting.locationAccuracy && (
              <Text className="text-xs text-muted">
                Accuracy: ±{parseFloat(sighting.locationAccuracy).toFixed(0)}m
              </Text>
            )}

            {/* Map Preview */}
            <View
              style={{
                height: 200,
                borderRadius: 12,
                overflow: "hidden",
                marginTop: 8,
              }}
            >
              <MapView
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFillObject}
                initialRegion={{
                  latitude,
                  longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{ latitude, longitude }}
                  pinColor={getCredibilityColor(credibility)}
                />
              </MapView>
            </View>
          </View>

          {/* Notes */}
          {sighting.notes && (
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Notes</Text>
              <View className="bg-surface border border-border rounded-lg p-4">
                <Text className="text-foreground">{sighting.notes}</Text>
              </View>
            </View>
          )}

          {/* Timestamp */}
          <View className="items-center">
            <Text className="text-xs text-muted">
              Reported {new Date(sighting.createdAt).toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
