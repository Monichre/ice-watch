import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const DEVICE_ID_KEY = "@vehicle_tracker_device_id";

/**
 * Get or create a unique device ID for anonymous tracking
 * This ID persists across app launches but is reset if app is uninstalled
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Try to get existing device ID
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      // Generate new device ID using crypto
      deviceId = Crypto.randomUUID();
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  } catch (error) {
    console.error("Failed to get/create device ID:", error);
    // Fallback to timestamp-based ID
    return `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
