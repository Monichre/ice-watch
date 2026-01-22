import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type SightingItem = {
  id: number;
  licensePlate: string;
  vehicleType: string | null;
  photoUrl: string;
  locationAddress: string | null;
  latitude: string;
  longitude: string;
  credibilityScore: string;
  upvotes: number;
  downvotes: number;
  createdAt: Date;
};

export default function SightingsScreen() {
  const colors = useColors();
  const [sortBy, setSortBy] = useState<"recent" | "credibility">("recent");

  const { data: sightings, isLoading, refetch, isRefetching } = trpc.sightings.list.useQuery({
    hideHidden: true,
    limit: 50,
  });

  const getCredibilityColor = (score: string): string => {
    const credibility = parseFloat(score);
    if (credibility >= 70) return "#22C55E";
    if (credibility >= 40) return "#F59E0B";
    return "#EF4444";
  };

  const sortedSightings = sightings
    ? [...sightings].sort((a, b) => {
        if (sortBy === "credibility") {
          return parseFloat(b.credibilityScore as string) - parseFloat(a.credibilityScore as string);
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
    : [];

  const handleItemPress = (id: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(`/sighting/${id}` as any);
  };

  const handleSortToggle = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSortBy((prev) => (prev === "recent" ? "credibility" : "recent"));
  };

  const renderItem = ({ item }: { item: SightingItem }) => {
    const credibility = parseFloat(item.credibilityScore as string);
    const totalVotes = item.upvotes + item.downvotes;
    const timeAgo = getTimeAgo(new Date(item.createdAt));

    return (
      <Pressable
        onPress={() => handleItemPress(item.id)}
        style={(state) => ({
          backgroundColor: colors.surface,
          marginHorizontal: 16,
          marginVertical: 6,
          borderRadius: 12,
          overflow: "hidden",
          opacity: state.pressed ? 0.7 : 1,
        })}
      >
        <View className="flex-row">
          {/* Thumbnail */}
          <Image
            source={{ uri: item.photoUrl }}
            style={{
              width: 100,
              height: 100,
              backgroundColor: colors.border,
            }}
            resizeMode="cover"
          />

          {/* Info */}
          <View className="flex-1 p-3 justify-between">
            <View>
              <Text className="text-lg font-bold text-foreground font-mono">
                {item.licensePlate}
              </Text>
              {item.vehicleType && (
                <Text className="text-xs text-muted mt-1">{item.vehicleType}</Text>
              )}
            </View>

            <View className="gap-1">
              {item.locationAddress && (
                <Text className="text-xs text-muted" numberOfLines={1}>
                  {item.locationAddress}
                </Text>
              )}
              <View className="flex-row items-center gap-2">
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 8,
                    backgroundColor: getCredibilityColor(item.credibilityScore) + "20",
                  }}
                >
                  <Text
                    style={{
                      color: getCredibilityColor(item.credibilityScore),
                      fontWeight: "600",
                      fontSize: 10,
                    }}
                  >
                    {credibility.toFixed(0)}%
                  </Text>
                </View>
                <Text className="text-xs text-muted">{totalVotes} votes</Text>
                <Text className="text-xs text-muted">• {timeAgo}</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View className="p-4 border-b border-border">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-foreground">Sightings</Text>
            <Pressable
              onPress={handleSortToggle}
              style={(state) => ({
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: colors.surface,
                opacity: state.pressed ? 0.7 : 1,
              })}
            >
              <Text className="text-xs font-semibold text-primary">
                {sortBy === "recent" ? "Most Recent" : "Top Verified"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={sortedSightings}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingVertical: 8 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center p-8">
                <Text className="text-muted text-center">
                  No sightings yet. Be the first to report a vehicle!
                </Text>
              </View>
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
