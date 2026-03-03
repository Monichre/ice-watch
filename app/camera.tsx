import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function CameraScreen() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [captureFlash, setCaptureFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    requestCameraAccess();
    // Pre-warm GPS
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsReady(true);
          setGpsCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => setGpsReady(false),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    }
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const requestCameraAccess = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setStream(mediaStream);
      setHasPermission(true);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch {
      setHasPermission(false);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;
    setIsCapturing(true);
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 200);

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);

      const photoBase64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
      const photoUri = canvas.toDataURL("image/jpeg", 0.85);

      // Get fresh GPS if we don't have it
      let location = gpsCoords ? { latitude: gpsCoords.lat, longitude: gpsCoords.lon } : null;
      let locationAccuracy: number | null = null;

      if (!location) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true, timeout: 10000,
            });
          });
          location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          locationAccuracy = position.coords.accuracy;
        } catch {
          Alert.alert("Location Required", "GPS coordinates are needed to submit a sighting. Please enable location permissions.");
          setIsCapturing(false);
          return;
        }
      }

      // Stop camera stream before navigating
      if (stream) stream.getTracks().forEach((t) => t.stop());

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
    } catch {
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleClose = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    router.back();
  };

  if (hasPermission === null) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ color: "#888", marginTop: 12 }}>Requesting camera access…</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", padding: 32 }]}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>📷</Text>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 }}>
          Camera Access Required
        </Text>
        <Text style={{ color: "#888", fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 20 }}>
          Camera permission is needed to photograph vehicles. Please allow access in your browser settings.
        </Text>
        <Pressable
          onPress={requestCameraAccess}
          style={({ pressed }) => [styles.grantBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.grantBtnText}>Grant Camera Access</Text>
        </Pressable>
        <Pressable onPress={handleClose} style={{ marginTop: 16 }}>
          <Text style={{ color: "#555", fontSize: 14 }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera feed */}
      <div style={{ position: "absolute", inset: 0 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {/* Capture flash overlay */}
      {captureFlash && (
        <View style={styles.flashOverlay} />
      )}

      {/* Dark gradient top */}
      <View style={styles.topGradient} />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>✕</Text>
        </Pressable>

        <View style={styles.titlePill}>
          <Text style={styles.titleText}>Capture Vehicle</Text>
        </View>

        {/* GPS status */}
        <View style={[styles.gpsPill, { backgroundColor: gpsReady ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)" }]}>
          <View style={[styles.gpsDot, { backgroundColor: gpsReady ? "#fff" : "#fca5a5" }]} />
          <Text style={styles.gpsText}>{gpsReady ? "GPS" : "No GPS"}</Text>
        </View>
      </View>

      {/* ── License plate targeting overlay ── */}
      <View style={styles.overlayContainer}>
        {/* Dimmed areas */}
        <View style={styles.dimTop} />
        <View style={styles.dimRow}>
          <View style={styles.dimSide} />
          {/* Target frame */}
          <View style={styles.targetFrame}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {/* Center scan line */}
            <View style={styles.scanLine} />
          </View>
          <View style={styles.dimSide} />
        </View>
        <View style={styles.dimBottom} />
      </View>

      {/* ── Targeting label ── */}
      <View style={styles.targetLabel}>
        <Text style={styles.targetLabelText}>Align license plate within frame</Text>
      </View>

      {/* GPS coordinates display */}
      {gpsCoords && (
        <View style={styles.coordsDisplay}>
          <Text style={styles.coordsText}>
            {gpsCoords.lat.toFixed(5)}, {gpsCoords.lon.toFixed(5)}
          </Text>
        </View>
      )}

      {/* Dark gradient bottom */}
      <View style={styles.bottomGradient} />

      {/* ── Bottom capture controls ── */}
      <View style={styles.bottomBar}>
        <View style={{ width: 56 }} />

        {/* Capture button */}
        <Pressable
          onPress={handleCapture}
          disabled={isCapturing}
          style={({ pressed }) => [
            styles.captureBtn,
            { transform: [{ scale: pressed ? 0.93 : 1 }], opacity: isCapturing ? 0.7 : 1 },
          ]}
        >
          <View style={styles.captureBtnInner}>
            {isCapturing ? (
              <ActivityIndicator size="small" color="#0d0d1a" />
            ) : (
              <View style={styles.captureBtnCore} />
            )}
          </View>
        </Pressable>

        {/* Upload from gallery */}
        <Pressable
          onPress={() => {
            if (stream) stream.getTracks().forEach((t) => t.stop());
            router.push("/submit" as any);
          }}
          style={({ pressed }) => [styles.galleryBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={{ fontSize: 22 }}>🖼</Text>
        </Pressable>
      </View>

      <Text style={styles.captureHint}>
        {isCapturing ? "Capturing & locating…" : "Tap to capture"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", position: "relative" },

  flashOverlay: {
    position: "absolute", inset: 0,
    backgroundColor: "rgba(255,255,255,0.7)",
    zIndex: 100,
  },

  topGradient: {
    position: "absolute", top: 0, left: 0, right: 0, height: 120,
    zIndex: 10,
  } as any,
  bottomGradient: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: 180,
    zIndex: 10,
  } as any,

  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingTop: 48, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    zIndex: 20,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  titlePill: {
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  titleText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  gpsPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
  },
  gpsDot: { width: 6, height: 6, borderRadius: 3 },
  gpsText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  // Targeting overlay
  overlayContainer: {
    position: "absolute", inset: 0, zIndex: 15,
  },
  dimTop: { flex: 2, backgroundColor: "rgba(0,0,0,0.45)" },
  dimRow: { flexDirection: "row", height: 80 },
  dimSide: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  dimBottom: { flex: 3, backgroundColor: "rgba(0,0,0,0.45)" },
  targetFrame: {
    width: 260, height: 80,
    position: "relative",
  },
  corner: {
    position: "absolute", width: 20, height: 20,
    borderColor: "#fff", borderWidth: 0,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
  scanLine: {
    position: "absolute", top: "50%", left: 10, right: 10, height: 1,
    backgroundColor: "rgba(59,130,246,0.7)",
  },

  targetLabel: {
    position: "absolute", zIndex: 20,
    top: "50%", left: 0, right: 0,
    marginTop: 50, alignItems: "center",
  },
  targetLabelText: {
    color: "rgba(255,255,255,0.7)", fontSize: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10,
  },

  coordsDisplay: {
    position: "absolute", bottom: 130, left: 0, right: 0,
    alignItems: "center", zIndex: 20,
  },
  coordsText: {
    color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "monospace",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },

  // Bottom controls
  bottomBar: {
    position: "absolute", bottom: 40, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 40, zIndex: 20,
  },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 3, borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
  },
  captureBtnInner: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
  },
  captureBtnCore: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#fff",
  },
  galleryBtn: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },

  captureHint: {
    position: "absolute", bottom: 16, left: 0, right: 0,
    textAlign: "center", color: "rgba(255,255,255,0.5)",
    fontSize: 12, zIndex: 20,
  },

  grantBtn: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14,
  },
  grantBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
