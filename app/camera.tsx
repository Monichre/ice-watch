import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { router } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

export default function CameraScreen() {
  const colors = useColors();
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
    })();
  }, []);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-lg text-foreground text-center mb-4">
          Camera permission is required to capture vehicle photos
        </Text>
        <Pressable
          onPress={requestPermission}
          className="bg-primary px-6 py-3 rounded-full"
          style={({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: true,
      });

      if (!photo) {
        throw new Error("Failed to capture photo");
      }

      // Get current location
      let location = null;
      let locationAccuracy = null;

      if (locationPermission === Location.PermissionStatus.GRANTED) {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          location = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          locationAccuracy = loc.coords.accuracy;
        } catch (error) {
          console.warn("Failed to get location:", error);
        }
      }

      // Try to extract GPS from EXIF if location not available
      if (!location && photo.exif) {
        const { GPSLatitude, GPSLongitude } = photo.exif as any;
        if (GPSLatitude && GPSLongitude) {
          location = {
            latitude: GPSLatitude,
            longitude: GPSLongitude,
          };
        }
      }

      if (!location) {
        Alert.alert(
          "Location Required",
          "GPS coordinates are required to submit a sighting. Please enable location permissions.",
          [{ text: "OK" }]
        );
        setIsCapturing(false);
        return;
      }

      // Navigate to submission form with photo data
      router.push({
        pathname: "/submit" as any,
        params: {
          photoUri: photo.uri,
          photoBase64: photo.base64 || "",
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
          locationAccuracy: locationAccuracy?.toString() || "",
          exifData: JSON.stringify(photo.exif || {}),
        },
      });
    } catch (error) {
      console.error("Capture error:", error);
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleClose = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing}>
        {/* Top bar */}
        <View className="absolute top-0 left-0 right-0 pt-12 px-4 flex-row items-center justify-between">
          <Pressable
            onPress={handleClose}
            style={(state) => [
              styles.closeButton,
              { opacity: state.pressed ? 0.6 : 1 },
            ]}
          >
            <IconSymbol name="chevron.left" size={24} color="white" />
          </Pressable>

          {/* GPS status indicator */}
          <View
            style={{
              backgroundColor: locationPermission === Location.PermissionStatus.GRANTED
                ? "rgba(34, 197, 94, 0.8)"
                : "rgba(239, 68, 68, 0.8)",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
            }}
          >
            <Text className="text-white text-xs font-semibold">
              {locationPermission === Location.PermissionStatus.GRANTED ? "GPS Active" : "GPS Off"}
            </Text>
          </View>

          <View style={{ width: 48 }} />
        </View>

        {/* Bottom capture button */}
        <View className="absolute bottom-0 left-0 right-0 pb-12 items-center">
          <Pressable
            onPress={handleCapture}
            disabled={isCapturing}
            style={(state) => [
              styles.captureButton,
              { borderColor: colors.primary },
              {
                opacity: state.pressed ? 0.8 : 1,
                transform: [{ scale: state.pressed ? 0.95 : 1 }],
              },
            ]}
          >
            {isCapturing ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.primary,
                }}
              />
            )}
          </Pressable>

          <Text className="text-white text-sm mt-4">
            {isCapturing ? "Capturing..." : "Capture Vehicle"}
          </Text>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
    borderRadius: 24,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "white",
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
