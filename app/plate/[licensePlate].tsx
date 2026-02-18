import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { LeafletMap } from "@/components/leaflet-map";

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
};

export default function PlateTrackingScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const licensePlate = (params.licensePlate as string) || "";

  const { data: sightings, isLoading, refetch } = trpc.plates.getByPlate.useQuery({
    licensePlate,
  });

  const handleBack = () => {
    router.back();
  };

  const handleSightingPress = (sightingId: number) => {
    router.push(`/sighting/${sightingId}` as any);
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!sightings || sightings.length === 0) {
    return (
      <ScreenContainer>
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Pressable
            onPress={handleBack}
            style={(state) => ({ opacity: state.pressed ? 0.6 : 1 })}
          >
            <IconSymbol name="chevron.left" size={28} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">Plate Tracking</Text>
          <View style={{ width: 28 }} />
        </View>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted text-center">No sightings found for this plate</Text>
        </View>
      </ScreenContainer>
    );
  }

  const typedSightings = sightings as Sighting[];
  const markers = typedSightings.map((s) => ({
    id: s.id,
    latitude: parseFloat(s.latitude),
    longitude: parseFloat(s.longitude),
    licensePlate: s.licensePlate,
    vehicleType: s.vehicleType,
    credibilityScore: s.credibilityScore,
    upvotes: s.upvotes,
    downvotes: s.downvotes,
  }));

  const centerLat =
    markers.reduce((sum, m) => sum + m.latitude, 0) / markers.length;
  const centerLng =
    markers.reduce((sum, m) => sum + m.longitude, 0) / markers.length;

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
          <Text className="text-xl font-bold text-foreground">Plate Tracking</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Plate Info */}
        <View className="p-4 border-b border-border">
          <Text className="text-3xl font-bold text-foreground font-mono text-center">
            {licensePlate}
          </Text>
          <Text className="text-center text-muted mt-2">
            {typedSightings.length} sighting{typedSightings.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* Map */}
        <View style={{ height: 300, position: "relative" }}>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <LeafletMap
              markers={markers}
              center={[centerLat, centerLng]}
              zoom={12}
              onMarkerClick={(marker) => handleSightingPress(marker.id)}
            />
          </div>
        </View>

        {/* Timeline */}
        <View className="p-4 gap-4">
          <Text className="text-lg font-bold text-foreground">Sighting History</Text>

          {typedSightings.map((sighting, index) => {
            const credibility = parseFloat(sighting.credibilityScore);
            const getCredibilityColor = (score: number): string => {
              if (score >= 70) return "#22C55E";
              if (score >= 40) return "#F59E0B";
              return "#EF4444";
            };

            return (
              <Pressable
                key={sighting.id}
                onPress={() => handleSightingPress(sighting.id)}
                style={(state) => ({
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: state.pressed ? 0.7 : 1,
                })}
              >
                <View className="flex-row gap-3">
                  {/* Photo */}
                  <Image
                    source={{ uri: sighting.photoUrl }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                      backgroundColor: colors.background,
                    }}
                    resizeMode="cover"
                  />

                  {/* Info */}
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-foreground font-semibold">
                        #{typedSightings.length - index}
                      </Text>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 8,
                          backgroundColor: getCredibilityColor(credibility) + "20",
                        }}
                      >
                        <Text
                          style={{
                            color: getCredibilityColor(credibility),
                            fontWeight: "600",
                            fontSize: 10,
                          }}
                        >
                          {credibility.toFixed(0)}%
                        </Text>
                      </View>
                    </View>

                    {sighting.locationAddress && (
                      <Text className="text-xs text-muted" numberOfLines={2}>
                        {sighting.locationAddress}
                      </Text>
                    )}

                    <Text className="text-xs text-muted">
                      {new Date(sighting.createdAt).toLocaleString()}
                    </Text>

                    {sighting.vehicleType && (
                      <Text className="text-xs text-foreground">
                        {sighting.vehicleType}
                      </Text>
                    )}
                  </View>

                  <IconSymbol name="chevron.right" size={20} color={colors.muted} />
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
