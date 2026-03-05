import {useState, useEffect, useMemo} from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  Animated,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  ScrollView,
  PanResponder,
  Platform,
  useWindowDimensions,
} from 'react-native'
import {router} from 'expo-router'
import {ScreenContainer} from '@/components/screen-container'
import {trpc} from '@/lib/trpc'
import {getDeviceId} from '@/lib/device-id'

const AGENCY_COLORS: Record<string, string> = {
  ICE: '#EF4444',
  CBP: '#F59E0B',
  DHS: '#8B5CF6',
  FBI: '#3B82F6',
  DEA: '#10B981',
  ATF: '#F97316',
  USMS: '#EC4899',
  Other: '#6B7280',
}

type SightingItem = {
  id: number
  licensePlate: string
  vehicleType: string | null
  photoUrl: string
  locationAddress: string | null
  latitude: string
  longitude: string
  credibilityScore: string
  upvotes: number
  downvotes: number
  createdAt: Date
  agencyType?: string | null
}

type TrendingPlate = {
  plate: string
  count: number
  lastSeen: Date
  agencyType: string | null
  avgCredibility: number
}

type ConvoyAlert = {
  centerLat: number
  centerLon: number
  vehicleCount: number
  plates: string[]
  agencies: string[]
  firstSeen: Date
  lastSeen: Date
}

function getCredColor(score: string | number): string {
  const n = typeof score === 'string' ? parseFloat(score) : score
  if (n >= 70) return '#22C55E'
  if (n >= 40) return '#F59E0B'
  return '#EF4444'
}

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function distKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type Tab = 'recent' | 'trending' | 'convoys'

export default function SightingsScreen() {
  const {width} = useWindowDimensions()
  const isDesktop = Platform.OS === 'web' && width >= 1100
  const contentWidth = isDesktop ? Math.min(1080, width - 36) : undefined
  const [activeTab, setActiveTab] = useState<Tab>('recent')
  const [sortBy, setSortBy] = useState<'recent' | 'credibility'>('recent')
  const [userLocation, setUserLocation] = useState<{
    lat: number
    lon: number
  } | null>(null)

  const {
    data: sightings,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.sightings.list.useQuery({hideHidden: true, limit: 100})
  const {data: trendingData} = trpc.trending.plates.useQuery({limit: 15})
  const {data: convoyData} = trpc.convoy.detect.useQuery({
    radiusKm: 0.5,
    windowMinutes: 15,
    minVehicles: 2,
  })

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setUserLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          }),
        () => {},
      )
    }
  }, [])

  const sortedSightings = useMemo(() => {
    if (!sightings) return []
    return [...sightings].sort((a, b) => {
      if (sortBy === 'credibility')
        return (
          parseFloat(b.credibilityScore as string) -
          parseFloat(a.credibilityScore as string)
        )
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [sightings, sortBy])

  const voteOnSighting = trpc.votes.cast.useMutation()

  const renderSightingCard = ({item}: {item: SightingItem}) => {
    const cred = parseFloat(item.credibilityScore as string)
    const credColor = getCredColor(cred)
    const agencyColor = item.agencyType
      ? AGENCY_COLORS[item.agencyType] || '#6B7280'
      : null
    const dist = userLocation
      ? distKm(
          userLocation.lat,
          userLocation.lon,
          parseFloat(item.latitude),
          parseFloat(item.longitude),
        )
      : null
    const distLabel =
      dist !== null
        ? dist < 1
          ? `${(dist * 1000).toFixed(0)}m away`
          : `${dist.toFixed(1)}km away`
        : null
    const isConfirmed = item.upvotes >= 3 && cred >= 60

    // Swipe-to-vote via PanResponder.
    const translateX = new Animated.Value(0)

    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx)
      },
      onPanResponderRelease: async (_, g) => {
        if (Math.abs(g.dx) > 60) {
          const voteType = g.dx > 0 ? 'upvote' : 'downvote'
          const deviceId = await getDeviceId()
          voteOnSighting.mutate({deviceId, sightingId: item.id, voteType})
        }
        Animated.spring(translateX, {toValue: 0, useNativeDriver: true}).start()
      },
    })

    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={{transform: [{translateX}]}}
      >
        <Pressable
          onPress={() => router.push(`/sighting/${item.id}` as any)}
          style={({pressed}) => [styles.card, {opacity: pressed ? 0.85 : 1}]}
        >
          {/* Photo */}
          <View style={{position: 'relative'}}>
            <Image
              source={{uri: item.photoUrl}}
              style={styles.cardPhoto}
              resizeMode='cover'
            />
            {item.agencyType && agencyColor && (
              <View
                style={[
                  styles.cardAgencyBadge,
                  {backgroundColor: agencyColor + 'dd'},
                ]}
              >
                <Text style={styles.cardAgencyText}>{item.agencyType}</Text>
              </View>
            )}
            {isConfirmed && (
              <View style={styles.cardConfirmedBadge}>
                <Text style={styles.cardConfirmedText}>✓</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <Text style={styles.cardPlate}>{item.licensePlate}</Text>
              <Text style={styles.cardTime}>{timeAgo(item.createdAt)}</Text>
            </View>

            {item.vehicleType && (
              <Text style={styles.cardVehicleType}>{item.vehicleType}</Text>
            )}

            {item.locationAddress && (
              <Text style={styles.cardAddress} numberOfLines={1}>
                {item.locationAddress}
              </Text>
            )}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 6,
              }}
            >
              {/* Cred pill */}
              <View
                style={[
                  styles.credPill,
                  {
                    backgroundColor: credColor + '22',
                    borderColor: credColor + '55',
                  },
                ]}
              >
                <View style={[styles.credDot, {backgroundColor: credColor}]} />
                <Text style={[styles.credPillText, {color: credColor}]}>
                  {cred.toFixed(0)}%
                </Text>
              </View>
              <Text style={styles.voteText}>
                {item.upvotes + item.downvotes} votes
              </Text>
              {distLabel && <Text style={styles.distText}>· {distLabel}</Text>}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    )
  }

  const renderTrendingCard = (item: TrendingPlate, index: number) => {
    const agencyColor = item.agencyType
      ? AGENCY_COLORS[item.agencyType] || '#6B7280'
      : '#6B7280'
    return (
      <Pressable
        key={item.plate}
        onPress={() =>
          router.push(`/plate/${encodeURIComponent(item.plate)}` as any)
        }
        style={({pressed}) => [styles.trendCard, {opacity: pressed ? 0.85 : 1}]}
      >
        <View style={styles.trendRank}>
          <Text style={styles.trendRankText}>#{index + 1}</Text>
        </View>
        <View style={{flex: 1}}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Text style={styles.trendPlate}>{item.plate}</Text>
            {item.agencyType && (
              <View
                style={[
                  styles.trendAgencyBadge,
                  {
                    backgroundColor: agencyColor + '22',
                    borderColor: agencyColor + '55',
                  },
                ]}
              >
                <Text style={[styles.trendAgencyText, {color: agencyColor}]}>
                  {item.agencyType}
                </Text>
              </View>
            )}
          </View>
          <View style={{flexDirection: 'row', gap: 12}}>
            <Text style={styles.trendStat}>{item.count} sightings</Text>
            <Text style={styles.trendStat}>Last: {timeAgo(item.lastSeen)}</Text>
            <Text
              style={[
                styles.trendStat,
                {color: getCredColor(item.avgCredibility)},
              ]}
            >
              {item.avgCredibility.toFixed(0)}% cred
            </Text>
          </View>
        </View>
        <Text style={styles.trendArrow}>→</Text>
      </Pressable>
    )
  }

  const renderConvoyCard = (convoy: ConvoyAlert, index: number) => (
    <View key={index} style={styles.convoyCard}>
      <View style={styles.convoyHeader}>
        <View style={styles.convoyAlertBadge}>
          <Text style={styles.convoyAlertText}>⚠ CONVOY</Text>
        </View>
        <Text style={styles.convoyTime}>{timeAgo(convoy.lastSeen)}</Text>
      </View>
      <Text style={styles.convoyVehicleCount}>
        {convoy.vehicleCount} vehicles
      </Text>
      {convoy.agencies.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
        >
          {convoy.agencies.map((a) => (
            <View
              key={a}
              style={[
                styles.convoyAgencyBadge,
                {
                  backgroundColor: (AGENCY_COLORS[a] || '#6B7280') + '22',
                  borderColor: (AGENCY_COLORS[a] || '#6B7280') + '55',
                },
              ]}
            >
              <Text
                style={[
                  styles.convoyAgencyText,
                  {color: AGENCY_COLORS[a] || '#6B7280'},
                ]}
              >
                {a}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.convoyPlates} numberOfLines={2}>
        Plates: {convoy.plates.join(', ')}
      </Text>
      <Text style={styles.convoyCoords}>
        {convoy.centerLat.toFixed(4)}, {convoy.centerLon.toFixed(4)}
      </Text>
    </View>
  )

  return (
    <ScreenContainer containerClassName='bg-background' webMaxWidth={1320}>
      <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
        {/* ── Header ── */}
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <Text style={styles.headerTitle}>Reports</Text>
          {activeTab === 'recent' && (
            <Pressable
              onPress={() =>
                setSortBy((v) => (v === 'recent' ? 'credibility' : 'recent'))
              }
              style={({pressed}) => [
                styles.sortBtn,
                {opacity: pressed ? 0.8 : 1},
              ]}
            >
              <Text style={styles.sortBtnText}>
                {sortBy === 'recent' ? '⏱ Recent' : '✓ Verified'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Tab bar ── */}
        <View style={[styles.tabBar, isDesktop && styles.tabBarDesktop]}>
          {(['recent', 'trending', 'convoys'] as Tab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab === 'recent'
                  ? 'Recent'
                  : tab === 'trending'
                    ? 'Trending'
                    : 'Convoys'}
              </Text>
              {tab === 'convoys' && (convoyData?.length ?? 0) > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{convoyData!.length}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* ── Content ── */}
        {activeTab === 'recent' &&
          (isLoading ? (
            <View
              style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}
            >
              <ActivityIndicator size='large' color='#3B82F6' />
            </View>
          ) : (
            <FlatList
              data={sortedSightings as SightingItem[]}
              renderItem={renderSightingCard}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                gap: 10,
                width: contentWidth,
                alignSelf: isDesktop ? 'center' : undefined,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={refetch}
                  tintColor='#3B82F6'
                />
              }
              ListEmptyComponent={
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 40,
                  }}
                >
                  <Text style={{color: '#555', textAlign: 'center'}}>
                    No sightings yet. Be the first to report!
                  </Text>
                </View>
              }
            />
          ))}

        {activeTab === 'trending' && (
          <ScrollView
            contentContainerStyle={{
              padding: 14,
              gap: 10,
              width: contentWidth,
              alignSelf: isDesktop ? 'center' : undefined,
            }}
          >
            <Text style={styles.sectionSubtitle}>
              Most reported in the last 24 hours
            </Text>
            {!trendingData || trendingData.length === 0 ? (
              <Text style={{color: '#555', textAlign: 'center', marginTop: 40}}>
                No trending plates yet.
              </Text>
            ) : (
              (trendingData as TrendingPlate[]).map((item, i) =>
                renderTrendingCard(item, i),
              )
            )}
          </ScrollView>
        )}

        {activeTab === 'convoys' && (
          <ScrollView
            contentContainerStyle={{
              padding: 14,
              gap: 10,
              width: contentWidth,
              alignSelf: isDesktop ? 'center' : undefined,
            }}
          >
            <Text style={styles.sectionSubtitle}>
              Multiple vehicles spotted together (last 15 min)
            </Text>
            {!convoyData || convoyData.length === 0 ? (
              <View style={{alignItems: 'center', marginTop: 40}}>
                <Text
                  style={{
                    color: '#22C55E',
                    fontSize: 16,
                    fontWeight: '700',
                    marginBottom: 8,
                  }}
                >
                  ✓ No convoys detected
                </Text>
                <Text
                  style={{color: '#555', textAlign: 'center', fontSize: 13}}
                >
                  No clusters of 2+ vehicles have been reported in the same area
                  within the last 15 minutes.
                </Text>
              </View>
            ) : (
              (convoyData as ConvoyAlert[]).map((c, i) =>
                renderConvoyCard(c, i),
              )
            )}
          </ScrollView>
        )}
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  shellDesktop: {
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(129,167,227,0.26)',
  },
  headerDesktop: {
    paddingHorizontal: 24,
    borderBottomWidth: 0,
    paddingBottom: 10,
  },
  headerTitle: {
    color: '#edf5ff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
    fontFamily: 'Unbounded',
  },
  sortBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(10,18,34,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(129,167,227,0.24)',
    minHeight: 40,
    justifyContent: 'center',
  },
  sortBtnText: {
    color: '#b1c3e1',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(129,167,227,0.18)',
    paddingHorizontal: 10,
    gap: 6,
  },
  tabBarDesktop: {
    borderBottomWidth: 0,
    marginHorizontal: 24,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(10,18,34,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(129,167,227,0.14)',
  },
  tabActive: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(129,167,227,0.4)',
    borderColor: 'rgba(86,204,255,0.46)',
    backgroundColor: 'rgba(14,30,52,0.84)',
  },
  tabText: {
    color: '#88a0c8',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },
  tabTextActive: {color: '#56CCFF', fontSize: 13},
  tabBadge: {
    backgroundColor: '#FF667D',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'JetBrains Mono',
  },

  sectionSubtitle: {
    color: '#8fa3c6',
    fontSize: 12,
    marginBottom: 10,
    fontFamily: 'JetBrains Mono',
  },

  // Sighting card
  card: {
    backgroundColor: 'rgba(12,20,36,0.86)',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(129,167,227,0.2)',
    flexDirection: 'row',
    minHeight: 96,
  },
  cardPhoto: {width: 108, height: 108, backgroundColor: '#0d1526'},
  cardAgencyBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cardAgencyText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardConfirmedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(34,197,94,0.9)',
    borderRadius: 5,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardConfirmedText: {color: '#fff', fontSize: 9, fontWeight: '900'},
  cardInfo: {flex: 1, padding: 10},
  cardPlate: {
    color: '#eef6ff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Unbounded',
    letterSpacing: 0.8,
  },
  cardTime: {color: '#89a0c5', fontSize: 11, fontFamily: 'JetBrains Mono'},
  cardVehicleType: {
    color: '#a2b4d4',
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'JetBrains Mono',
  },
  cardAddress: {color: '#8da2c6', fontSize: 11, marginTop: 2},
  credPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  credDot: {width: 5, height: 5, borderRadius: 3},
  credPillText: {fontSize: 10, fontWeight: '700'},
  voteText: {color: '#8da2c6', fontSize: 11, fontFamily: 'JetBrains Mono'},
  distText: {color: '#8da2c6', fontSize: 11, fontFamily: 'JetBrains Mono'},

  // Trending card
  trendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(12,20,36,0.86)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(129,167,227,0.18)',
  },
  trendRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendRankText: {
    color: '#56CCFF',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'JetBrains Mono',
  },
  trendPlate: {
    color: '#eff6ff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Unbounded',
    letterSpacing: 0.6,
  },
  trendAgencyBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  trendAgencyText: {fontSize: 10, fontWeight: '800', letterSpacing: 0.5},
  trendStat: {color: '#8da2c6', fontSize: 11, fontFamily: 'JetBrains Mono'},
  trendArrow: {color: '#6b86b8', fontSize: 16},

  // Convoy card
  convoyCard: {
    backgroundColor: 'rgba(255,102,125,0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,102,125,0.32)',
  },
  convoyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  convoyAlertBadge: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  convoyAlertText: {
    color: '#FF667D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'JetBrains Mono',
  },
  convoyTime: {color: '#9ab0d6', fontSize: 11, fontFamily: 'JetBrains Mono'},
  convoyVehicleCount: {
    color: '#eff6ff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    fontFamily: 'Unbounded',
  },
  convoyAgencyBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  convoyAgencyText: {fontSize: 11, fontWeight: '800'},
  convoyPlates: {
    color: '#b5c6e3',
    fontSize: 12,
    fontFamily: 'JetBrains Mono',
    marginBottom: 4,
  },
  convoyCoords: {color: '#8aa0c6', fontSize: 11, fontFamily: 'JetBrains Mono'},
})
