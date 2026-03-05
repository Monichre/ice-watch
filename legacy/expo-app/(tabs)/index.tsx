import {useState, useEffect, useMemo, useRef} from 'react'
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native'
import {router} from 'expo-router'
import {ScreenContainer} from '@/components/screen-container'
import {useColors} from '@/hooks/use-colors'
import {trpc} from '@/lib/trpc'
import {LeafletMap} from '@/components/leaflet-map'
import {IconSymbol} from '@/components/ui/icon-symbol'
import {useProximityAlerts} from '@/hooks/use-proximity-alerts'
import {
  getCachedSightings,
  mergeSightingsCache,
  setLastFetchTime,
  type CachedSighting,
} from '@/lib/sightings-cache'

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

type MarkerData = {
  id: number
  latitude: number
  longitude: number
  licensePlate: string
  vehicleType: string | null
  credibilityScore: string
  upvotes: number
  downvotes: number
  agencyType?: string | null
  isRecent?: boolean
}

export default function MapScreen() {
  const colors = useColors()
  const {width} = useWindowDimensions()
  const isDesktop = Platform.OS === 'web' && width >= 1200
  const isTabletWeb = Platform.OS === 'web' && width >= 900
  const [userLocation, setUserLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [newSightingsCount, setNewSightingsCount] = useState(0)
  const [proximityEnabled, setProximityEnabled] = useState(false)
  const [cachedSightings, setCachedSightings] = useState<CachedSighting[]>([])
  const lastSightingCountRef = useRef(0)

  const {
    data: sightings,
    isLoading,
    refetch,
  } = trpc.sightings.list.useQuery({
    hideHidden: true,
    limit: 100,
  })

  // Load offline cache on mount for instant rendering
  useEffect(() => {
    getCachedSightings().then((cached) => {
      if (cached.length > 0) setCachedSightings(cached)
    })
  }, [])

  // Merge server data into cache when it arrives
  useEffect(() => {
    if (!sightings || sightings.length === 0) return
    const normalized = (sightings as any[]).map((s) => ({
      ...s,
      createdAt:
        typeof s.createdAt === 'string'
          ? s.createdAt
          : new Date(s.createdAt).toISOString(),
    })) as CachedSighting[]
    mergeSightingsCache(normalized).then(setCachedSightings)
    setLastFetchTime()
  }, [sightings])

  // Get user location on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        (err) => console.warn('Location error:', err),
      )
    }
  }, [])

  // Real-time polling every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => refetch(), 10000)
    return () => clearInterval(interval)
  }, [refetch])

  // New sightings badge
  useEffect(() => {
    if (!sightings) return
    const prev = lastSightingCountRef.current
    if (prev > 0 && sightings.length > prev) {
      setNewSightingsCount(sightings.length - prev)
      setTimeout(() => setNewSightingsCount(0), 6000)
    }
    lastSightingCountRef.current = sightings.length
  }, [sightings])

  // Proximity alerts hook
  const activeSightings = (sightings as any[] | undefined) || cachedSightings
  useProximityAlerts({
    enabled: proximityEnabled,
    radiusKm: 2,
    userLat: userLocation?.latitude ?? null,
    userLng: userLocation?.longitude ?? null,
    sightings: activeSightings,
  })

  const sourceSightings = useMemo(() => {
    if (sightings && sightings.length > 0) return sightings as any[]
    return cachedSightings as any[]
  }, [sightings, cachedSightings])

  // Build markers with isRecent flag
  const allMarkers: MarkerData[] = useMemo(() => {
    const now = Date.now()
    return sourceSightings.map((s) => ({
      id: s.id,
      latitude: parseFloat(s.latitude as string),
      longitude: parseFloat(s.longitude as string),
      licensePlate: s.licensePlate,
      vehicleType: s.vehicleType,
      credibilityScore: s.credibilityScore as string,
      upvotes: s.upvotes,
      downvotes: s.downvotes,
      agencyType: (s as any).agencyType ?? null,
      isRecent: now - new Date(s.createdAt).getTime() < 10 * 60 * 1000,
    }))
  }, [sourceSightings])

  // Filtered markers
  const markers: MarkerData[] = useMemo(() => {
    let result = allMarkers
    if (selectedAgency) {
      result = result.filter((m) => m.agencyType === selectedAgency)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase()
      result = result.filter((m) => m.licensePlate.includes(q))
    }
    return result
  }, [allMarkers, selectedAgency, searchQuery])

  // Unique agencies in data
  const agencies = useMemo(() => {
    const set = new Set<string>()
    allMarkers.forEach((m) => {
      if (m.agencyType) set.add(m.agencyType)
    })
    return Array.from(set).sort()
  }, [allMarkers])

  const mapCenter: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : [37.7749, -122.4194]

  const shouldShowLoader = isLoading && sourceSightings.length === 0

  const averageCredibility = useMemo(() => {
    if (markers.length === 0) return 0
    const sum = markers.reduce(
      (total, marker) => total + parseFloat(marker.credibilityScore),
      0,
    )
    return sum / markers.length
  }, [markers])

  const freshSignals = useMemo(
    () => markers.filter((marker) => marker.isRecent).length,
    [markers],
  )

  const getCredColor = (score: string) => {
    const n = parseFloat(score)
    if (n >= 70) return '#22C55E'
    if (n >= 40) return '#F59E0B'
    return '#EF4444'
  }

  const handleRecenter = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (error) =>
        console.debug(
          'Recenter failed:',
          error?.message ?? 'unknown geolocation error',
        ),
    )
  }

  return (
    <ScreenContainer
      edges={['top', 'left', 'right']}
      containerClassName='bg-background'
      disableWebMaxWidth
    >
      <View style={styles.container}>
        {/* Map fills full screen */}
        {shouldShowLoader ? (
          <View
            style={[
              styles.container,
              {
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0d0d1a',
              },
            ]}
          >
            <ActivityIndicator size='large' color={colors.primary} />
            <Text
              style={{
                color: '#7e95bc',
                marginTop: 12,
                fontFamily: 'JetBrains Mono',
              }}
            >
              Booting signal grid...
            </Text>
          </View>
        ) : (
          <div style={styles.mapLayer as any}>
            <LeafletMap
              markers={markers}
              center={mapCenter}
              zoom={14}
              onMarkerClick={setSelectedMarker}
              showUserLocation
              userLocation={userLocation}
              showHeatmap={showHeatmap}
            />
          </div>
        )}

        <View style={styles.uiLayer} pointerEvents='box-none'>
          <View pointerEvents='none' style={styles.overlayVignette} />

          <View
            style={[styles.topCluster, isDesktop && styles.topClusterDesktop]}
          >
            <View
              style={[styles.brandPanel, isDesktop && styles.brandPanelDesktop]}
            >
              <View style={styles.brandRow}>
                <Text style={styles.brandEyebrow}>COMMUNITY SIGNAL NET</Text>
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.brandTitle}>ICE WATCH</Text>
              <View style={styles.metricsRow}>
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>TRACKED</Text>
                  <Text style={styles.metricValue}>{markers.length}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>HOT</Text>
                  <Text style={[styles.metricValue, {color: '#f97316'}]}>
                    {freshSignals}
                  </Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricCell}>
                  <Text style={styles.metricLabel}>TRUST</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      {color: getCredColor(`${averageCredibility}`)},
                    ]}
                  >
                    {averageCredibility.toFixed(0)}%
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[styles.searchBox, isDesktop && styles.searchBoxDesktop]}
            >
              <IconSymbol name='magnifyingglass' size={18} color='#94a3b8' />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder='Scan plate signature'
                placeholderTextColor='#6b7280'
                style={styles.searchInput}
                autoCapitalize='characters'
                returnKeyType='search'
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  style={styles.searchClearBtn}
                  accessibilityLabel='Clear plate search'
                  accessibilityRole='button'
                >
                  <Text style={styles.searchClearText}>CLEAR</Text>
                </Pressable>
              )}
            </View>
          </View>
          {agencies.length > 0 && (
            <View
              style={[
                styles.filterRow,
                isDesktop && styles.filterRowDesktop,
                isTabletWeb && styles.filterRowTablet,
              ]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScrollContent}
              >
                <Pressable
                  onPress={() => setSelectedAgency(null)}
                  style={[styles.chip, !selectedAgency && styles.chipActive]}
                  accessibilityLabel='Show all agencies'
                  accessibilityRole='button'
                >
                  <Text
                    style={[
                      styles.chipText,
                      !selectedAgency && styles.chipTextActive,
                    ]}
                  >
                    All
                  </Text>
                </Pressable>
                {agencies.map((agency) => {
                  const active = selectedAgency === agency
                  const color = AGENCY_COLORS[agency] || '#6B7280'
                  return (
                    <Pressable
                      key={agency}
                      onPress={() => setSelectedAgency(active ? null : agency)}
                      style={[
                        styles.chip,
                        active && {
                          backgroundColor: color + '33',
                          borderColor: color,
                        },
                      ]}
                      accessibilityLabel={`${active ? 'Clear' : 'Filter by'} ${agency}`}
                      accessibilityRole='button'
                    >
                      <View
                        style={[styles.chipDot, {backgroundColor: color}]}
                      />
                      <Text style={[styles.chipText, active && {color}]}>
                        {agency}
                      </Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>
          )}

          <View
            style={[styles.mapControls, isDesktop && styles.mapControlsDesktop]}
          >
            <Pressable
              onPress={() => setShowHeatmap((v) => !v)}
              style={[
                styles.controlBtn,
                showHeatmap && styles.controlBtnActive,
              ]}
              accessibilityLabel={
                showHeatmap ? 'Disable heatmap' : 'Enable heatmap'
              }
              accessibilityRole='button'
            >
              <IconSymbol
                name='flame.fill'
                size={20}
                color={showHeatmap ? '#fb923c' : '#94a3b8'}
              />
            </Pressable>

            <Pressable
              onPress={() => setProximityEnabled((v) => !v)}
              style={[
                styles.controlBtn,
                proximityEnabled && styles.controlBtnActive,
              ]}
              accessibilityLabel={
                proximityEnabled
                  ? 'Disable proximity alerts'
                  : 'Enable proximity alerts'
              }
              accessibilityRole='button'
            >
              <IconSymbol
                name='bell.fill'
                size={20}
                color={proximityEnabled ? '#22c55e' : '#94a3b8'}
              />
            </Pressable>

            <Pressable
              onPress={() => refetch()}
              style={styles.controlBtn}
              accessibilityLabel='Sync sightings'
              accessibilityRole='button'
            >
              <Text style={styles.controlText}>SYNC</Text>
            </Pressable>

            {userLocation && (
              <Pressable
                onPress={handleRecenter}
                style={styles.controlBtn}
                accessibilityLabel='Recenter to my location'
                accessibilityRole='button'
              >
                <IconSymbol name='location.fill' size={20} color='#94a3b8' />
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                if (typeof window !== 'undefined') {
                  window.open('/widget', '_blank')
                }
              }}
              style={styles.controlBtn}
              accessibilityLabel='Open embeddable widget'
              accessibilityRole='button'
            >
              <IconSymbol name='map.fill' size={20} color='#94a3b8' />
            </Pressable>
          </View>

          <View
            style={[
              styles.bottomTelemetry,
              isDesktop && styles.bottomTelemetryDesktop,
            ]}
          >
            <View style={styles.telemetryPanel}>
              <Text style={styles.telemetryText}>
                {markers.length} signal{markers.length !== 1 ? 's' : ''}
                {selectedAgency ? ` · ${selectedAgency}` : ''}
                {searchQuery ? ` · ${searchQuery}` : ''}
              </Text>
              {newSightingsCount > 0 && (
                <View style={styles.newSignalPill}>
                  <Text style={styles.newSignalText}>
                    +{newSightingsCount} new
                  </Text>
                </View>
              )}
            </View>
          </View>

          {selectedMarker && (
            <View
              style={[styles.markerCard, isDesktop && styles.markerCardDesktop]}
            >
              {(selectedMarker as any).agencyType && (
                <View
                  style={[
                    styles.agencyBadge,
                    {
                      backgroundColor:
                        (AGENCY_COLORS[(selectedMarker as any).agencyType] ||
                          '#6B7280') + '22',
                      borderColor:
                        (AGENCY_COLORS[(selectedMarker as any).agencyType] ||
                          '#6B7280') + '88',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.agencyBadgeText,
                      {
                        color:
                          AGENCY_COLORS[(selectedMarker as any).agencyType] ||
                          '#6B7280',
                      },
                    ]}
                  >
                    {(selectedMarker as any).agencyType}
                  </Text>
                </View>
              )}

              <View style={styles.markerHeadRow}>
                <View>
                  <Text style={styles.markerEyebrow}>VEHICLE SIGNATURE</Text>
                  <Text style={styles.plateText}>
                    {selectedMarker.licensePlate}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedMarker(null)}
                  style={({pressed}) => ({opacity: pressed ? 0.55 : 1})}
                >
                  <Text style={styles.closeText}>CLOSE</Text>
                </Pressable>
              </View>

              {selectedMarker.vehicleType && (
                <Text style={styles.vehicleTypeText}>
                  {selectedMarker.vehicleType}
                </Text>
              )}

              <View style={styles.credRow}>
                <View style={styles.credBarBg}>
                  <View
                    style={[
                      styles.credBarFill,
                      {
                        width:
                          `${parseFloat(selectedMarker.credibilityScore)}%` as any,
                        backgroundColor: getCredColor(
                          selectedMarker.credibilityScore,
                        ),
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.credText,
                    {color: getCredColor(selectedMarker.credibilityScore)},
                  ]}
                >
                  {parseFloat(selectedMarker.credibilityScore).toFixed(0)}%
                </Text>
                <Text style={styles.voteText}>
                  {selectedMarker.upvotes + selectedMarker.downvotes} votes
                </Text>
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={() =>
                    router.push(
                      `/plate/${encodeURIComponent(selectedMarker.licensePlate)}` as any,
                    )
                  }
                  style={({pressed}) => [
                    styles.btnOutline,
                    {opacity: pressed ? 0.8 : 1},
                  ]}
                  accessibilityLabel='Open plate tracking'
                  accessibilityRole='button'
                >
                  <IconSymbol
                    name='car.fill'
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.btnOutlineText, {color: colors.primary}]}
                  >
                    Track
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push(`/sighting/${selectedMarker.id}` as any)
                  }
                  style={({pressed}) => [
                    styles.btnFill,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  accessibilityLabel='Open sighting details'
                  accessibilityRole='button'
                >
                  <IconSymbol
                    name='checkmark.shield.fill'
                    size={16}
                    color='#fff'
                  />
                  <Text style={styles.btnFillText}>Inspect</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Pressable
            onPress={() => router.push('/camera' as any)}
            style={({pressed}) => [
              styles.fab,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
                transform: [{scale: pressed ? 0.95 : 1}],
              },
              isDesktop && styles.fabDesktop,
            ]}
            accessibilityLabel='Create new sighting report'
            accessibilityRole='button'
          >
            <IconSymbol name='camera.fill' size={24} color='#fff' />
            <Text style={styles.fabLabel}>REPORT</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  container: {flex: 1, position: 'relative'},
  mapLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
  },
  uiLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: 2000,
  },

  overlayVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3,8,18,0.22)',
  },

  topCluster: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 14,
    paddingHorizontal: 14,
    gap: 10,
    zIndex: 10,
  },
  topClusterDesktop: {
    right: 'auto',
    width: 470,
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  brandPanel: {
    backgroundColor: 'rgba(8,14,28,0.84)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(129,167,227,0.28)',
    padding: 14,
    shadowColor: '#020617',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
  },
  brandPanelDesktop: {
    borderRadius: 24,
    padding: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  brandEyebrow: {
    color: '#7ed8ff',
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },

  brandTitle: {
    marginTop: 6,
    color: '#f0f6ff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1.4,
    fontFamily: 'Unbounded',
  },

  metricsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11,18,33,0.64)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(145,176,228,0.2)',
    paddingVertical: 8,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  metricLabel: {
    color: '#95abd0',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'JetBrains Mono',
  },
  metricValue: {
    color: '#ecf4ff',
    fontSize: 17,
    fontWeight: '800',
    fontFamily: 'Unbounded',
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(8,14,28,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(145,176,228,0.24)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchBoxDesktop: {
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: '#eaf2ff',
    fontSize: 13,
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.5,
  },
  searchClearBtn: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(71,85,105,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  searchClearText: {
    color: '#9ab0d6',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },

  filterRow: {
    position: 'absolute',
    top: 190,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  filterRowDesktop: {
    top: 258,
    left: 18,
    right: 'auto',
    width: 470,
  },
  filterRowTablet: {
    top: 196,
  },
  filterScrollContent: {
    gap: 8,
    paddingHorizontal: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: 'rgba(56,189,248,0.18)',
    borderColor: '#38bdf8',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.5,
  },
  chipTextActive: {color: '#38bdf8'},
  chipDot: {width: 6, height: 6, borderRadius: 3},

  mapControls: {
    position: 'absolute',
    right: 12,
    top: 236,
    gap: 10,
    zIndex: 11,
  },
  mapControlsDesktop: {
    top: 160,
    right: 18,
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(8,14,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(145,176,228,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#020617',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderColor: '#38bdf8',
  },
  controlText: {
    color: '#cfe0fb',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'JetBrains Mono',
  },

  bottomTelemetry: {
    position: 'absolute',
    bottom: 214,
    left: 12,
    right: 74,
    zIndex: 11,
  },
  bottomTelemetryDesktop: {
    left: 18,
    right: 'auto',
    width: 420,
    bottom: 124,
  },
  telemetryPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(8,14,28,0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(145,176,228,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  telemetryText: {
    color: '#9ab0d6',
    fontSize: 11,
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.4,
    flex: 1,
  },
  newSignalPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.4)',
  },
  newSignalText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: 'JetBrains Mono',
  },

  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(45,225,166,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(45,225,166,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveText: {
    color: '#2de1a6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'JetBrains Mono',
  },
  liveDot: {width: 7, height: 7, borderRadius: 999, backgroundColor: '#2de1a6'},

  markerCard: {
    position: 'absolute',
    bottom: 108,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(8,14,28,0.95)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(129,167,227,0.32)',
    shadowColor: '#020617',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 14,
    zIndex: 25,
  },
  markerCardDesktop: {
    left: 18,
    right: 'auto',
    width: 470,
    bottom: 118,
    borderRadius: 24,
    padding: 20,
  },
  markerHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  markerEyebrow: {
    color: '#7e95bc',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },
  closeText: {
    color: '#9ab0d6',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },
  agencyBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  agencyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'JetBrains Mono',
  },
  plateText: {
    color: '#f3f8ff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: 'Unbounded',
  },
  vehicleTypeText: {
    color: '#9ab0d6',
    fontSize: 12,
    marginBottom: 10,
    fontFamily: 'JetBrains Mono',
  },
  credRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  credBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  credBarFill: {height: 6, borderRadius: 999},
  credText: {fontSize: 12, fontWeight: '700', fontFamily: 'JetBrains Mono'},
  voteText: {color: '#7e95bc', fontSize: 11, fontFamily: 'JetBrains Mono'},

  actionRow: {flexDirection: 'row', gap: 8, marginTop: 14},
  btnOutline: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(145,176,228,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(13,21,37,0.72)',
  },
  btnOutlineText: {
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.5,
  },
  btnFill: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  btnFillText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.5,
  },

  fab: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    width: 74,
    height: 74,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    shadowColor: '#56CCFF',
    shadowOffset: {width: 0, height: 7},
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 20,
  },
  fabDesktop: {
    right: 24,
    bottom: 128,
    width: 82,
    height: 82,
    borderRadius: 25,
  },
  fabLabel: {
    color: '#eaf2ff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'JetBrains Mono',
  },
})
