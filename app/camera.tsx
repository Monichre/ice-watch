import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, Platform, StyleSheet } from "react-native";
import { router } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function CameraScreen() {
  const colors = useColors();
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    requestCameraAccess();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const requestCameraAccess = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(mediaStream);
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Camera access error:", error);
      setHasPermission(false);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      // Capture frame from video
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);

      // Convert to base64
      const photoBase64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
      const photoUri = canvas.toDataURL("image/jpeg", 0.8);

      // Get current location
      let location = null;
      let locationAccuracy = null;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });

        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        locationAccuracy = position.coords.accuracy;
      } catch (error) {
        console.warn("Failed to get location:", error);
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
          photoUri,
          photoBase64,
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
          locationAccuracy: locationAccuracy?.toString() || "",
          exifData: JSON.stringify({}),
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
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    router.back();
  };

  if (hasPermission === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-lg text-foreground text-center mb-4">
          Camera permission is required to capture vehicle photos
        </Text>
        <Pressable
          onPress={requestCameraAccess}
          className="bg-primary px-6 py-3 rounded-full"
          style={(state) => ({ opacity: state.pressed ? 0.8 : 1 })}
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />

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
              backgroundColor: "rgba(34, 197, 94, 0.8)",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
            }}
          >
            <Text className="text-white text-xs font-semibold">Camera Active</Text>
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
      </div>
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
