import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { getDeviceId } from "@/lib/device-id";

const VEHICLE_TYPES = ["Sedan", "SUV", "Truck", "Van", "Motorcycle", "Other"];

export default function SubmitScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();

  const [licensePlate, setLicensePlate] = useState("");
  const [vehicleType, setVehicleType] = useState("SUV");
  const [notes, setNotes] = useState("");
  const [locationAddress, setLocationAddress] = useState("Loading address...");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const photoUri = params.photoUri as string;
  const photoBase64 = params.photoBase64 as string;
  const latitude = parseFloat(params.latitude as string);
  const longitude = parseFloat(params.longitude as string);
  const locationAccuracy = parseFloat(params.locationAccuracy as string) || 0;

  const createSightingMutation = trpc.sightings.create.useMutation();

  useEffect(() => {
    // Reverse geocode to get address
    (async () => {
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (addresses && addresses.length > 0) {
          const addr = addresses[0];
          const parts = [
            addr.street,
            addr.city,
            addr.region,
            addr.postalCode,
          ].filter(Boolean);
          setLocationAddress(parts.join(", ") || "Unknown location");
        } else {
          setLocationAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
      } catch (error) {
        console.warn("Failed to reverse geocode:", error);
        setLocationAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
    })();
  }, [latitude, longitude]);

  const handleSubmit = async () => {
    if (!licensePlate.trim()) {
      Alert.alert("Required Field", "Please enter a license plate number.");
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsSubmitting(true);

    try {
      const deviceId = await getDeviceId();

      await createSightingMutation.mutateAsync({
        licensePlate: licensePlate.trim().toUpperCase(),
        vehicleType,
        photoBase64,
        latitude,
        longitude,
        locationAccuracy,
        locationAddress,
        notes: notes.trim() || undefined,
        photoMetadata: params.exifData as string,
        deviceId,
      });

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        "Success!",
        "Vehicle sighting has been submitted to the network.",
        [
          {
            text: "OK",
            onPress: () => {
              router.replace("/");
            },
          },
        ]
      );
    } catch (error) {
      console.error("Submit error:", error);
      Alert.alert(
        "Submission Failed",
        "Failed to submit sighting. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <Pressable
            onPress={handleCancel}
            style={(state) => ({ opacity: state.pressed ? 0.6 : 1 })}
          >
            <IconSymbol name="chevron.left" size={28} color={colors.foreground} />
          </Pressable>
          <Text className="text-xl font-bold text-foreground">Submit Sighting</Text>
          <View style={{ width: 28 }} />
        </View>

        <View className="p-4 gap-6">
          {/* Photo Preview */}
          <View className="items-center">
            <Image
              source={{ uri: photoUri }}
              style={{
                width: "100%",
                height: 240,
                borderRadius: 12,
                backgroundColor: colors.surface,
              }}
              resizeMode="cover"
            />
          </View>

          {/* License Plate Input */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">
              License Plate <Text className="text-error">*</Text>
            </Text>
            <TextInput
              value={licensePlate}
              onChangeText={setLicensePlate}
              placeholder="Enter plate number"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-lg font-mono"
              style={{ color: colors.foreground }}
            />
          </View>

          {/* Vehicle Type Picker */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Vehicle Type</Text>
            <View className="flex-row flex-wrap gap-2">
              {VEHICLE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => {
                    setVehicleType(type);
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  style={(state) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor:
                      vehicleType === type ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: vehicleType === type ? colors.primary : colors.border,
                    opacity: state.pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: vehicleType === type ? "white" : colors.foreground,
                      fontWeight: vehicleType === type ? "600" : "400",
                    }}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Location Info */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Location</Text>
            <View className="bg-surface border border-border rounded-lg p-4 gap-2">
              <Text className="text-foreground">{locationAddress}</Text>
              <Text className="text-xs text-muted">
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </Text>
              {locationAccuracy > 0 && (
                <Text className="text-xs text-muted">
                  Accuracy: ±{locationAccuracy.toFixed(0)}m
                </Text>
              )}
            </View>
          </View>

          {/* Notes Input */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">
              Notes (Optional)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any additional details..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              returnKeyType="done"
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              style={{ color: colors.foreground, minHeight: 100 }}
            />
          </View>

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={(state) => ({
              backgroundColor: colors.primary,
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: "center",
              opacity: state.pressed || isSubmitting ? 0.7 : 1,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-semibold">Submit to Network</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
