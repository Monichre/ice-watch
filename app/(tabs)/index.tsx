import { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Platform } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { LeafletMap } from "@/components/leaflet-map";

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
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);

  const { data: sightings, isLoading, refetch } = trpc.sightings.list.useQuery({
    hideHidden: true,
    limit: 500, // Increased limit for all sightings
  });

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("Failed to get location:", error);
        }
      );
    }
  }, []);

  // Real-time updates: poll every 10 seconds for new sightings
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10000); // 10 seconds for real-time feel

    return () => clearInterval(interval);
  }, [refetch]);

  // Show new sightings indicator
  const [newSightingsCount, setNewSightingsCount] = useState(0);
  const [lastSightingCount, setLastSightingCount] = useState(0);

  useEffect(() => {
    if (sightings && sightings.length > lastSightingCount && lastSightingCount > 0) {
      setNewSightingsCount(sightings.length - lastSightingCount);
      // Auto-clear notification after 5 seconds
      setTimeout(() => setNewSightingsCount(0), 5000);
    }
    if (sightings) {
      setLastSightingCount(sightings.length);
    }
  }, [sightings]);

  const handleCameraPress = () => {
    router.push("/camera" as any);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleMarkerClick = (marker: MarkerData) => {
    setSelectedMarker(marker);
  };

  const handleViewPlateTracking = (licensePlate: string) => {
    router.push(`/plate/${encodeURIComponent(licensePlate)}` as any);
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

  // Always center on user location if available, otherwise use default
  const mapCenter: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : [37.7749, -122.4194];

  // Use higher zoom when centered on user
  const mapZoom = userLocation ? 14 : 13;

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
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <LeafletMap
              markers={markers}
              center={mapCenter}
              zoom={mapZoom}
              onMarkerClick={handleMarkerClick}
              showUserLocation={true}
              userLocation={userLocation}
            />
          </div>
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
              position: "relative",
            }}
          >
            <Text className="text-foreground font-bold">Vehicle Tracker</Text>
            {newSightingsCount > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  backgroundColor: "#EF4444",
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 6,
                }}
              >
                <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>
                  +{newSightingsCount}
                </Text>
              </View>
            )}
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

            <View className="flex-row gap-2 mt-3">
              <Pressable
                onPress={() => handleViewPlateTracking(selectedMarker.licensePlate)}
                style={(state) => ({
                  flex: 1,
                  backgroundColor: colors.surface,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  alignItems: "center",
                  opacity: state.pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: colors.primary, fontWeight: "600" }}>Track Plate</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  router.push(`/sighting/${selectedMarker.id}` as any);
                }}
                style={(state) => ({
                  flex: 1,
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
