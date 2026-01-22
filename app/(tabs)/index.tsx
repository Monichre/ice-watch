import { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type MarkerData = {
  id: number;
  latitude: number;
  longitude: number;
  licensePlate: string;
  vehicleType: string | null;
  credibilityScore: string;
  upvotes: number;
  downvotes: number;
};

export default function MapScreen() {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);

  const { data: sightings, isLoading, refetch } = trpc.sightings.list.useQuery({
    hideHidden: true,
    limit: 100,
  });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);

      if (status === Location.PermissionStatus.GRANTED) {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } catch (error) {
          console.warn("Failed to get location:", error);
        }
      }
    })();
  }, []);

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetch]);

  const handleCameraPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push("/camera" as any);
  };

  const handleRefresh = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    refetch();
  };

  const handleMarkerPress = (marker: MarkerData) => {
    setSelectedMarker(marker);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const getMarkerColor = (credibilityScore: string): string => {
    const score = parseFloat(credibilityScore);
    if (score >= 70) return "#22C55E"; // Green
    if (score >= 40) return "#F59E0B"; // Yellow
    return "#EF4444"; // Red
  };

  const markers: MarkerData[] =
    sightings?.map((s) => ({
      id: s.id,
      latitude: parseFloat(s.latitude as string),
      longitude: parseFloat(s.longitude as string),
      licensePlate: s.licensePlate,
      vehicleType: s.vehicleType,
      credibilityScore: s.credibilityScore as string,
      upvotes: s.upvotes,
      downvotes: s.downvotes,
    })) || [];

  const initialRegion = userLocation
    ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View className="flex-1">
        {/* Map */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center bg-background">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-muted mt-4">Loading map...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFillObject}
            initialRegion={initialRegion}
            showsUserLocation={locationPermission === Location.PermissionStatus.GRANTED}
            showsMyLocationButton={false}
          >
            {markers.map((marker) => (
              <Marker
                key={marker.id}
                coordinate={{
                  latitude: marker.latitude,
                  longitude: marker.longitude,
                }}
                pinColor={getMarkerColor(marker.credibilityScore)}
                onPress={() => handleMarkerPress(marker)}
              />
            ))}
          </MapView>
        )}

        {/* Top Bar */}
        <View className="absolute top-0 left-0 right-0 pt-4 px-4 flex-row items-center justify-between">
          <View
            style={{
              backgroundColor: colors.background,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className="text-foreground font-bold">Vehicle Tracker</Text>
          </View>

          <Pressable
            onPress={handleRefresh}
            style={(state) => ({
              backgroundColor: colors.background,
              padding: 10,
              borderRadius: 20,
              opacity: state.pressed ? 0.7 : 1,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            })}
          >
            <IconSymbol name="paperplane.fill" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {/* Selected Marker Info */}
        {selectedMarker && (
          <View
            style={{
              position: "absolute",
              bottom: 100,
              left: 16,
              right: 16,
              backgroundColor: colors.background,
              borderRadius: 16,
              padding: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-2xl font-bold text-foreground font-mono">
                {selectedMarker.licensePlate}
              </Text>
              <Pressable
                onPress={() => setSelectedMarker(null)}
                style={(state) => ({ opacity: state.pressed ? 0.6 : 1 })}
              >
                <IconSymbol name="chevron.right" size={24} color={colors.muted} />
              </Pressable>
            </View>

            {selectedMarker.vehicleType && (
              <Text className="text-sm text-muted mb-2">{selectedMarker.vehicleType}</Text>
            )}

            <View className="flex-row items-center gap-4">
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: getMarkerColor(selectedMarker.credibilityScore) + "20",
                }}
              >
                <Text
                  style={{
                    color: getMarkerColor(selectedMarker.credibilityScore),
                    fontWeight: "600",
                    fontSize: 12,
                  }}
                >
                  {parseFloat(selectedMarker.credibilityScore).toFixed(0)}% Verified
                </Text>
              </View>

              <Text className="text-xs text-muted">
                {selectedMarker.upvotes + selectedMarker.downvotes} votes
              </Text>
            </View>

            <Pressable
              onPress={() => {
                router.push(`/sighting/${selectedMarker.id}` as any);
              }}
              style={(state) => ({
                marginTop: 12,
                backgroundColor: colors.primary,
                paddingVertical: 10,
                borderRadius: 8,
                alignItems: "center",
                opacity: state.pressed ? 0.8 : 1,
              })}
            >
              <Text className="text-white font-semibold">View Details</Text>
            </Pressable>
          </View>
        )}

        {/* Floating Action Button */}
        <Pressable
          onPress={handleCameraPress}
          style={(state) => ({
            position: "absolute",
            bottom: 24,
            right: 24,
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.primary,
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            opacity: state.pressed ? 0.8 : 1,
            transform: [{ scale: state.pressed ? 0.95 : 1 }],
          })}
        >
          <IconSymbol name="paperplane.fill" size={28} color="white" />
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
