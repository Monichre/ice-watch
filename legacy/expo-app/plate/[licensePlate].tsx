import {useState, useMemo, useEffect} from 'react'
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native'
import {router, useLocalSearchParams} from 'expo-router'
import {ScreenContainer} from '@/components/screen-container'
import {trpc} from '@/lib/trpc'
import {LeafletMap} from '@/components/leaflet-map'
import {
  isWatching,
  watchPlate,
  unwatchPlate,
  requestNotificationPermission,
  sendNotification,
} from '@/lib/notifications'

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

type Sighting = {
  id: number
  latitude: string
  longitude: string
  licensePlate: string
  vehicleType: string | null
  credibilityScore: string
  upvotes: number
  downvotes: number
  photoUrl: string
  createdAt: Date
  locationAddress: string | null
  agencyType?: string | null
  vehicleMake?: string | null
  vehicleModel?: string | null
  vehicleColor?: string | null
  badgeNumber?: string | null
}

function getCredColor(score: number): string {
  if (score >= 70) return '#22C55E'
  if (score >= 40) return '#F59E0B'
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

function calcBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function bearingToArrow(bearing: number): string {
  const dirs = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']
  return dirs[Math.round(bearing / 45) % 8]
}

function calcDistanceKm(
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

export default function PlateTrackingScreen() {
  const {width} = useWindowDimensions()
  const isDesktop = Platform.OS === 'web' && width >= 1080
  const params = useLocalSearchParams()
  const licensePlate = (params.licensePlate as string) || ''
  const [showMap, setShowMap] = useState(true)
  const [watching, setWatching] = useState(false)

  useEffect(() => {
    setWatching(isWatching(licensePlate))
  }, [licensePlate])

  const handleToggleWatch = async () => {
    if (watching) {
      unwatchPlate(licensePlate)
      setWatching(false)
    } else {
      const granted = await requestNotificationPermission()
      watchPlate(licensePlate)
      setWatching(true)
      if (granted) {
        sendNotification(
          `Watching ${licensePlate}`,
          "You'll be notified when this vehicle is spotted.",
          `watch-${licensePlate}`,
        )
      }
    }
  }

  const {data: sightings, isLoading} = trpc.plates.getByPlate.useQuery({
    licensePlate,
  })

  // Sort oldest → newest for timeline
  const sorted = useMemo(() => {
    const typedSightings: Sighting[] = (sightings as Sighting[]) || []
    return [...typedSightings].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
  }, [sightings])

  const markers = sorted.map((s) => ({
    id: s.id,
    latitude: parseFloat(s.latitude),
    longitude: parseFloat(s.longitude),
    licensePlate: s.licensePlate,
    vehicleType: s.vehicleType,
    credibilityScore: s.credibilityScore,
    upvotes: s.upvotes,
    downvotes: s.downvotes,
    agencyType: s.agencyType,
  }))

  const centerLat = markers.length
    ? markers.reduce((s, m) => s + m.latitude, 0) / markers.length
    : 37.7749
  const centerLng = markers.length
    ? markers.reduce((s, m) => s + m.longitude, 0) / markers.length
    : -122.4194

  // Total distance traveled
  const totalDistKm = useMemo(() => {
    let d = 0
    for (let i = 1; i < sorted.length; i++) {
      d += calcDistanceKm(
        parseFloat(sorted[i - 1].latitude),
        parseFloat(sorted[i - 1].longitude),
        parseFloat(sorted[i].latitude),
        parseFloat(sorted[i].longitude),
      )
    }
    return d
  }, [sorted])

  // Dominant agency
  const dominantAgency = useMemo(() => {
    const counts: Record<string, number> = {}
    sorted.forEach((s) => {
      if (s.agencyType) counts[s.agencyType] = (counts[s.agencyType] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  }, [sorted])

  const handleShare = async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/plate/${licensePlate}`
        : ''
    const text = `ICE Tracker: Plate ${licensePlate} — ${sorted.length} sighting(s) tracked`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `ICE Tracker: ${licensePlate}`,
          text,
          url,
        })
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        alert('Link copied to clipboard!')
      } else {
        alert(url)
      }
    } catch {}
  }

  const handleExportCSV = () => {
    const header =
      'id,licensePlate,latitude,longitude,locationAddress,vehicleType,agencyType,vehicleMake,vehicleModel,credibilityScore,upvotes,downvotes,createdAt'
    const rows = sorted.map((s) =>
      [
        s.id,
        s.licensePlate,
        s.latitude,
        s.longitude,
        `"${(s.locationAddress || '').replace(/"/g, "'")}"`,
        s.vehicleType || '',
        s.agencyType || '',
        s.vehicleMake || '',
        s.vehicleModel || '',
        s.credibilityScore,
        s.upvotes,
        s.downvotes,
        new Date(s.createdAt).toISOString(),
      ].join(','),
    )
    const csv = [header, ...rows].join('\n')
    if (typeof window !== 'undefined') {
      const blob = new Blob([csv], {type: 'text/csv'})
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `plate-${licensePlate}-history.csv`
      a.click()
    }
  }

  const handleExportJSON = () => {
    const json = JSON.stringify(sorted, null, 2)
    if (typeof window !== 'undefined') {
      const blob = new Blob([json], {type: 'application/json'})
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `plate-${licensePlate}-history.json`
      a.click()
    }
  }

  if (isLoading) {
    return (
      <ScreenContainer containerClassName='bg-background'>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator size='large' color='#3B82F6' />
        </View>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer containerClassName='bg-background' webMaxWidth={1400}>
      <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 40}}>
        <View style={[styles.canvas, isDesktop && styles.canvasDesktop]}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}
            >
              <Text style={styles.backBtn}>← Back</Text>
            </Pressable>
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Pressable
                onPress={handleToggleWatch}
                style={({pressed}) => [
                  styles.watchBtn,
                  watching && styles.watchBtnActive,
                  {opacity: pressed ? 0.8 : 1},
                ]}
              >
                <Text
                  style={[
                    styles.watchBtnText,
                    watching && styles.watchBtnTextActive,
                  ]}
                >
                  {watching ? '🔔 Watching' : '🔕 Watch'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleExportCSV}
                style={({pressed}) => [
                  styles.exportBtn,
                  {opacity: pressed ? 0.7 : 1},
                ]}
              >
                <Text style={styles.exportBtnText}>CSV ↓</Text>
              </Pressable>
              <Pressable
                onPress={handleExportJSON}
                style={({pressed}) => [
                  styles.exportBtn,
                  {opacity: pressed ? 0.7 : 1},
                ]}
              >
                <Text style={styles.exportBtnText}>JSON ↓</Text>
              </Pressable>
              <Pressable
                onPress={handleShare}
                style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}
              >
                <Text style={styles.shareBtn}>Share ↗</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Plate hero ── */}
          <View style={styles.hero}>
            {dominantAgency && (
              <View
                style={[
                  styles.agencyBadge,
                  {
                    backgroundColor:
                      (AGENCY_COLORS[dominantAgency] || '#6B7280') + '22',
                    borderColor:
                      (AGENCY_COLORS[dominantAgency] || '#6B7280') + '66',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.agencyText,
                    {color: AGENCY_COLORS[dominantAgency] || '#6B7280'},
                  ]}
                >
                  {dominantAgency}
                </Text>
              </View>
            )}
            <Text style={styles.plateHero}>{licensePlate}</Text>
            {sorted[0]?.vehicleColor && sorted[0]?.vehicleMake && (
              <Text style={styles.vehicleSubtitle}>
                {sorted[0].vehicleColor} {sorted[0].vehicleMake}{' '}
                {sorted[0].vehicleModel || ''}
              </Text>
            )}
          </View>

          {/* ── Stats row ── */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{sorted.length}</Text>
              <Text style={styles.statLabel}>Sightings</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalDistKm.toFixed(1)} km</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {sorted.length > 0
                  ? timeAgo(sorted[sorted.length - 1].createdAt)
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>Last seen</Text>
            </View>
          </View>

          {/* ── Map toggle ── */}
          <Pressable
            onPress={() => setShowMap((v) => !v)}
            style={({pressed}) => [
              styles.mapToggle,
              {opacity: pressed ? 0.8 : 1},
            ]}
          >
            <Text style={styles.mapToggleText}>
              {showMap ? '▲ Hide map' : '▼ Show map'}
            </Text>
          </Pressable>

          {/* ── Map ── */}
          {showMap && markers.length > 0 && (
            <View
              style={{
                height: 260,
                marginHorizontal: 12,
                borderRadius: 16,
                overflow: 'hidden',
                marginBottom: 16,
              }}
            >
              <div
                style={{position: 'relative', width: '100%', height: '100%'}}
              >
                <LeafletMap
                  markers={markers}
                  center={[centerLat, centerLng]}
                  zoom={12}
                  onMarkerClick={(m) => router.push(`/sighting/${m.id}` as any)}
                />
              </div>
            </View>
          )}

          {/* ── Timeline ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Movement Timeline</Text>

            {sorted.length === 0 && (
              <Text style={{color: '#555', textAlign: 'center', marginTop: 20}}>
                No sightings recorded yet.
              </Text>
            )}

            {sorted.map((sighting, index) => {
              const cred = parseFloat(sighting.credibilityScore)
              const credColor = getCredColor(cred)
              const isLast = index === sorted.length - 1
              const isFirst = index === 0

              // Direction arrow to next sighting
              let dirArrow = ''
              let distLabel = ''
              if (!isLast) {
                const next = sorted[index + 1]
                const bearing = calcBearing(
                  parseFloat(sighting.latitude),
                  parseFloat(sighting.longitude),
                  parseFloat(next.latitude),
                  parseFloat(next.longitude),
                )
                dirArrow = bearingToArrow(bearing)
                const dist = calcDistanceKm(
                  parseFloat(sighting.latitude),
                  parseFloat(sighting.longitude),
                  parseFloat(next.latitude),
                  parseFloat(next.longitude),
                )
                distLabel =
                  dist < 1
                    ? `${(dist * 1000).toFixed(0)}m`
                    : `${dist.toFixed(1)}km`
              }

              return (
                <View key={sighting.id}>
                  <Pressable
                    onPress={() =>
                      router.push(`/sighting/${sighting.id}` as any)
                    }
                    style={({pressed}) => [
                      styles.timelineCard,
                      {opacity: pressed ? 0.85 : 1},
                    ]}
                  >
                    {/* Timeline dot & line */}
                    <View style={styles.timelineDotCol}>
                      <View
                        style={[
                          styles.timelineDot,
                          {
                            backgroundColor: credColor,
                            boxShadow: `0 0 8px ${credColor}88`,
                          } as any,
                        ]}
                      />
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>

                    {/* Content */}
                    <View style={styles.timelineContent}>
                      {/* Top row: index + time */}
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Text style={styles.sightingIndex}>#{index + 1}</Text>
                          {isFirst && (
                            <View style={styles.firstBadge}>
                              <Text style={styles.firstBadgeText}>FIRST</Text>
                            </View>
                          )}
                          {isLast && (
                            <View style={styles.latestBadge}>
                              <Text style={styles.latestBadgeText}>LATEST</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.timeAgoText}>
                          {timeAgo(sighting.createdAt)}
                        </Text>
                      </View>

                      {/* Photo + info */}
                      <View style={{flexDirection: 'row', gap: 10}}>
                        <Image
                          source={{uri: sighting.photoUrl}}
                          style={styles.thumbnail}
                          resizeMode='cover'
                        />
                        <View style={{flex: 1, gap: 4}}>
                          {sighting.locationAddress ? (
                            <Text style={styles.addressText} numberOfLines={2}>
                              {sighting.locationAddress}
                            </Text>
                          ) : (
                            <Text style={styles.coordsText}>
                              {parseFloat(sighting.latitude).toFixed(4)},{' '}
                              {parseFloat(sighting.longitude).toFixed(4)}
                            </Text>
                          )}
                          {sighting.vehicleType && (
                            <Text style={styles.vehicleTypeText}>
                              {sighting.vehicleType}
                            </Text>
                          )}
                          {sighting.badgeNumber && (
                            <Text style={styles.badgeText}>
                              Badge: {sighting.badgeNumber}
                            </Text>
                          )}
                          {/* Credibility bar */}
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 2,
                            }}
                          >
                            <View style={styles.credBarBg}>
                              <View
                                style={[
                                  styles.credBarFill,
                                  {
                                    width: `${cred}%` as any,
                                    backgroundColor: credColor,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={[styles.credPct, {color: credColor}]}>
                              {cred.toFixed(0)}%
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Text style={styles.fullDateText}>
                        {new Date(sighting.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Movement connector between sightings */}
                  {!isLast && (
                    <View style={styles.movementConnector}>
                      <Text style={styles.movementArrow}>{dirArrow}</Text>
                      <Text style={styles.movementDist}>{distLabel}</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    alignSelf: 'center',
  },
  canvasDesktop: {
    width: 'min(1120px, 96%)' as any,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(129,167,227,0.24)',
  },
  backBtn: {
    color: '#56CCFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },
  shareBtn: {
    color: '#56CCFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },

  hero: {alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16},
  agencyBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 10,
  },
  agencyText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: 'JetBrains Mono',
  },
  plateHero: {
    color: '#f1f8ff',
    fontSize: 34,
    fontWeight: '800',
    fontFamily: 'Unbounded',
    letterSpacing: 1.4,
  },
  vehicleSubtitle: {
    color: '#9db1d3',
    fontSize: 13,
    marginTop: 6,
    fontFamily: 'JetBrains Mono',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(12,20,36,0.84)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129,167,227,0.2)',
  },
  statValue: {
    color: '#edf5ff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Unbounded',
  },
  statLabel: {
    color: '#95abd0',
    fontSize: 10,
    marginTop: 3,
    fontFamily: 'JetBrains Mono',
  },

  mapToggle: {
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(12,20,36,0.84)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129,167,227,0.2)',
  },
  mapToggleText: {color: '#a1b5d7', fontSize: 12, fontFamily: 'JetBrains Mono'},

  section: {paddingHorizontal: 12},
  sectionTitle: {
    color: '#eef5ff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 0.5,
    fontFamily: 'Unbounded',
  },

  timelineCard: {
    flexDirection: 'row',
    gap: 0,
  },
  timelineDotCol: {
    width: 28,
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    marginTop: 6,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 4,
    marginBottom: 0,
    minHeight: 40,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: 'rgba(12,20,36,0.84)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(129,167,227,0.2)',
    marginLeft: 4,
  },
  sightingIndex: {
    color: '#eef6ff',
    fontWeight: '800',
    fontSize: 13,
    fontFamily: 'JetBrains Mono',
  },
  firstBadge: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  firstBadgeText: {
    color: '#3B82F6',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  latestBadge: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  latestBadgeText: {
    color: '#22C55E',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  timeAgoText: {color: '#90a6cb', fontSize: 11, fontFamily: 'JetBrains Mono'},
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#1a1a2e',
  },
  addressText: {color: '#d4e3fb', fontSize: 12, lineHeight: 17},
  coordsText: {color: '#9ab0d6', fontSize: 11, fontFamily: 'JetBrains Mono'},
  vehicleTypeText: {
    color: '#9ab0d6',
    fontSize: 11,
    fontFamily: 'JetBrains Mono',
  },
  badgeText: {
    color: '#FFB647',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },
  credBarBg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  credBarFill: {height: 3, borderRadius: 2},
  credPct: {fontSize: 11, fontWeight: '700'},
  fullDateText: {
    color: '#7f95bd',
    fontSize: 10,
    marginTop: 6,
    fontFamily: 'JetBrains Mono',
  },

  movementConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 32,
    paddingVertical: 4,
  },
  movementArrow: {color: '#56CCFF', fontSize: 18, fontWeight: '800'},
  movementDist: {color: '#8ea4ca', fontSize: 11, fontFamily: 'JetBrains Mono'},
  watchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  watchBtnActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: 'rgba(34,197,94,0.4)',
  },
  watchBtnText: {
    color: '#afc1df',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },
  watchBtnTextActive: {color: '#22C55E'},
  exportBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  exportBtnText: {
    color: '#56CCFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },
})
