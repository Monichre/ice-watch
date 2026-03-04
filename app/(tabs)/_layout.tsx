import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform, View, StyleSheet } from "react-native";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // On mobile web, give generous bottom padding for home indicator / browser chrome
  const bottomPadding = Platform.OS === "web"
    ? Math.max(insets.bottom, 16)
    : Math.max(insets.bottom, 8);

  // Taller bar on web for easier tapping
  const tabBarHeight = Platform.OS === "web" ? 72 + bottomPadding : 60 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#3B82F6",
        tabBarInactiveTintColor: "#4B5563",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: Platform.OS === "web" ? 10 : 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: "#0d0d1a",
          borderTopColor: "rgba(255,255,255,0.1)",
          borderTopWidth: 1,
          // Elevated shadow for depth on mobile web
          ...(Platform.OS === "web" ? {
            boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
          } : {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 12,
          }),
        },
        tabBarLabelStyle: {
          fontSize: Platform.OS === "web" ? 12 : 10,
          fontWeight: "700",
          letterSpacing: 0.5,
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="map.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sightings"
        options={{
          title: "Reports",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.bullet" color={color} />,
        }}
      />
    </Tabs>
  );
}
