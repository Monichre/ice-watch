import {useState, useEffect} from 'react'
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native'
import {router, useLocalSearchParams} from 'expo-router'
import {ScreenContainer} from '@/components/screen-container'
import {trpc} from '@/lib/trpc'
import {getDeviceId} from '@/lib/device-id'
import {LeafletMap} from '@/components/leaflet-map'

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

function getCredColor(score: number) {
  if (score >= 70) return '#22C55E'
  if (score >= 40) return '#F59E0B'
  return '#EF4444'
}

function getCredLabel(score: number) {
  if (score >= 80) return 'High Confidence'
  if (score >= 60) return 'Likely Accurate'
  if (score >= 40) return 'Unverified'
  return 'Disputed'
}

export default function SightingDetailScreen() {
  const {width} = useWindowDimensions()
  const isDesktop = Platform.OS === 'web' && width >= 1080
  const params = useLocalSearchParams()
  const sightingId = parseInt(params.id as string)

  const [deviceId, setDeviceId] = useState<string>('')
  const [userVote, setUserVote] = useState<
    'upvote' | 'downvote' | 'flag' | null
  >(null)

  const {
    data: sighting,
    isLoading,
    refetch,
  } = trpc.sightings.getById.useQuery({id: sightingId})
  const {data: existingVote} = trpc.votes.getUserVote.useQuery(
    {deviceId, sightingId},
    {enabled: !!deviceId},
  )
  const castVoteMutation = trpc.votes.cast.useMutation()
  const removeVoteMutation = trpc.votes.remove.useMutation()

  useEffect(() => {
    ;(async () => {
      setDeviceId(await getDeviceId())
    })()
  }, [])

  useEffect(() => {
    if (existingVote) setUserVote(existingVote.voteType)
  }, [existingVote])

  const handleVote = async (voteType: 'upvote' | 'downvote' | 'flag') => {
    if (!deviceId) return
    try {
      if (userVote !== voteType) {
        await castVoteMutation.mutateAsync({deviceId, sightingId, voteType})
        setUserVote(voteType)
      } else {
        await removeVoteMutation.mutateAsync({deviceId, sightingId})
        setUserVote(null)
      }
      setTimeout(() => refetch(), 500)
    } catch {
      Alert.alert('Error', 'Failed to submit vote. Please try again.')
    }
  }

  const handleShare = async () => {
    if (!sighting) return
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/sighting/${sightingId}`
        : ''
    const text = `ICE Tracker: ${sighting.licensePlate} spotted — ${sighting.locationAddress || `${sighting.latitude}, ${sighting.longitude}`}`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `ICE Tracker: ${sighting.licensePlate}`,
          text,
          url,
        })
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        Alert.alert('Link Copied', 'Sighting link copied to clipboard!')
      } else {
        Alert.alert('Share Link', url)
      }
    } catch {}
  }

  if (isLoading || !sighting) {
    return (
      <ScreenContainer containerClassName='bg-background'>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator size='large' color='#3B82F6' />
        </View>
      </ScreenContainer>
    )
  }

  const credibility = parseFloat(sighting.credibilityScore as string)
  const latitude = parseFloat(sighting.latitude as string)
  const longitude = parseFloat(sighting.longitude as string)
  const credColor = getCredColor(credibility)
  const agencyColor = (sighting as any).agencyType
    ? AGENCY_COLORS[(sighting as any).agencyType] || '#6B7280'
    : null

  // "Confirmed by multiple sources" if upvotes >= 3 and credibility >= 60
  const isConfirmed = sighting.upvotes >= 3 && credibility >= 60

  return (
    <ScreenContainer containerClassName='bg-background' webMaxWidth={1400}>
      <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 40}}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}
          >
            <Text style={styles.backBtn}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Sighting</Text>
          <Pressable
            onPress={handleShare}
            style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}
          >
            <Text style={styles.shareBtn}>Share ↗</Text>
          </Pressable>
        </View>

        <View
          style={[styles.contentWrap, isDesktop && styles.contentWrapDesktop]}
        >
          {/* ── Photo ── */}
          <View style={{position: 'relative'}}>
            <Image
              source={{uri: sighting.photoUrl}}
              style={[styles.photo, isDesktop && styles.photoDesktop]}
              resizeMode='cover'
            />
            {/* Agency overlay on photo */}
            {(sighting as any).agencyType && agencyColor && (
              <View
                style={[
                  styles.photoAgencyBadge,
                  {backgroundColor: agencyColor + 'cc'},
                ]}
              >
                <Text style={styles.photoAgencyText}>
                  {(sighting as any).agencyType}
                </Text>
              </View>
            )}
            {isConfirmed && (
              <View style={styles.confirmedBadge}>
                <Text style={styles.confirmedText}>✓ CONFIRMED</Text>
              </View>
            )}
          </View>

          <View style={[styles.body, isDesktop && styles.bodyDesktop]}>
            {/* ── Plate + vehicle info ── */}
            <View style={styles.plateSection}>
              <Text style={styles.plateText}>{sighting.licensePlate}</Text>
              {(sighting as any).vehicleColor &&
                (sighting as any).vehicleMake && (
                  <Text style={styles.vehicleSubtitle}>
                    {(sighting as any).vehicleColor}{' '}
                    {(sighting as any).vehicleMake}{' '}
                    {(sighting as any).vehicleModel || ''}
                  </Text>
                )}
              {sighting.vehicleType && !(sighting as any).vehicleMake && (
                <Text style={styles.vehicleSubtitle}>
                  {sighting.vehicleType}
                </Text>
              )}
            </View>

            {/* ── Credibility panel ── */}
            <View style={[styles.credPanel, {borderColor: credColor + '44'}]}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <Text style={styles.credPanelTitle}>Community Credibility</Text>
                <Text style={[styles.credScore, {color: credColor}]}>
                  {credibility.toFixed(0)}%
                </Text>
              </View>
              {/* Credibility bar */}
              <View style={styles.credBarBg}>
                <View
                  style={[
                    styles.credBarFill,
                    {
                      width: `${credibility}%` as any,
                      backgroundColor: credColor,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.credLabel, {color: credColor}]}>
                {getCredLabel(credibility)}
              </Text>
              <View style={styles.voteCountRow}>
                <Text style={styles.voteCount}>
                  ✓ {sighting.upvotes} verified
                </Text>
                <Text style={styles.voteCount}>
                  ✗ {sighting.downvotes} disputed
                </Text>
                <Text style={styles.voteCount}>
                  🚩 {sighting.flagCount} flagged
                </Text>
              </View>
              {isConfirmed && (
                <View style={styles.confirmedPill}>
                  <Text style={styles.confirmedPillText}>
                    ✓ Confirmed by multiple sources
                  </Text>
                </View>
              )}
            </View>

            {/* ── Voting buttons ── */}
            <View style={styles.voteRow}>
              <Pressable
                onPress={() => handleVote('upvote')}
                style={({pressed}) => [
                  styles.voteBtn,
                  userVote === 'upvote' && {
                    backgroundColor: '#22C55E',
                    borderColor: '#22C55E',
                  },
                  {opacity: pressed ? 0.8 : 1},
                ]}
              >
                <Text
                  style={[
                    styles.voteBtnText,
                    userVote === 'upvote' && {color: '#fff'},
                  ]}
                >
                  ✓ Verified
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleVote('downvote')}
                style={({pressed}) => [
                  styles.voteBtn,
                  userVote === 'downvote' && {
                    backgroundColor: '#EF4444',
                    borderColor: '#EF4444',
                  },
                  {opacity: pressed ? 0.8 : 1},
                ]}
              >
                <Text
                  style={[
                    styles.voteBtnText,
                    userVote === 'downvote' && {color: '#fff'},
                  ]}
                >
                  ✗ Inaccurate
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleVote('flag')}
                style={({pressed}) => [
                  styles.voteBtnSmall,
                  userVote === 'flag' && {
                    backgroundColor: '#F59E0B',
                    borderColor: '#F59E0B',
                  },
                  {opacity: pressed ? 0.8 : 1},
                ]}
              >
                <Text
                  style={[
                    styles.voteBtnText,
                    userVote === 'flag' && {color: '#fff'},
                  ]}
                >
                  🚩
                </Text>
              </Pressable>
            </View>

            {/* ── AI Analysis panel ── */}
            {((sighting as any).agencyType ||
              (sighting as any).agencyMarkings ||
              (sighting as any).badgeNumber ||
              (sighting as any).uniformDescription) && (
              <View style={styles.aiPanel}>
                <Text style={styles.aiPanelTitle}>AI Analysis</Text>
                {(sighting as any).agencyType && agencyColor && (
                  <View style={styles.aiRow}>
                    <Text style={styles.aiLabel}>Agency</Text>
                    <View
                      style={[
                        styles.agencyChip,
                        {
                          backgroundColor: agencyColor + '22',
                          borderColor: agencyColor + '66',
                        },
                      ]}
                    >
                      <Text
                        style={[styles.agencyChipText, {color: agencyColor}]}
                      >
                        {(sighting as any).agencyType}
                      </Text>
                    </View>
                  </View>
                )}
                {(sighting as any).agencyMarkings && (
                  <View style={styles.aiRow}>
                    <Text style={styles.aiLabel}>Markings</Text>
                    <Text style={styles.aiValue}>
                      {(sighting as any).agencyMarkings}
                    </Text>
                  </View>
                )}
                {(sighting as any).badgeNumber && (
                  <View style={styles.aiRow}>
                    <Text style={styles.aiLabel}>Badge #</Text>
                    <Text
                      style={[
                        styles.aiValue,
                        {color: '#F59E0B', fontFamily: 'monospace'},
                      ]}
                    >
                      {(sighting as any).badgeNumber}
                    </Text>
                  </View>
                )}
                {(sighting as any).uniformDescription && (
                  <View style={styles.aiRow}>
                    <Text style={styles.aiLabel}>Uniform</Text>
                    <Text style={styles.aiValue}>
                      {(sighting as any).uniformDescription}
                    </Text>
                  </View>
                )}
                {(sighting as any).aiConfidence && (
                  <View style={styles.aiRow}>
                    <Text style={styles.aiLabel}>AI Confidence</Text>
                    <Text style={styles.aiValue}>
                      {(
                        parseFloat((sighting as any).aiConfidence) * 100
                      ).toFixed(0)}
                      %
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Location ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              {sighting.locationAddress && (
                <Text style={styles.addressText}>
                  {sighting.locationAddress}
                </Text>
              )}
              <Text style={styles.coordsText}>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </Text>
              {sighting.locationAccuracy && (
                <Text style={styles.accuracyText}>
                  GPS accuracy: ±
                  {parseFloat(sighting.locationAccuracy as string).toFixed(0)}m
                </Text>
              )}
              <View
                style={{
                  height: 200,
                  borderRadius: 14,
                  overflow: 'hidden',
                  marginTop: 10,
                }}
              >
                <div
                  style={{position: 'relative', width: '100%', height: '100%'}}
                >
                  <LeafletMap
                    markers={[
                      {
                        id: sighting.id,
                        latitude,
                        longitude,
                        licensePlate: sighting.licensePlate,
                        vehicleType: sighting.vehicleType,
                        credibilityScore: sighting.credibilityScore as string,
                        upvotes: sighting.upvotes,
                        downvotes: sighting.downvotes,
                        agencyType: (sighting as any).agencyType,
                      },
                    ]}
                    center={[latitude, longitude]}
                    zoom={15}
                  />
                </div>
              </View>
            </View>

            {/* ── Notes ── */}
            {sighting.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{sighting.notes}</Text>
                </View>
              </View>
            )}

            {/* ── Actions ── */}
            <Pressable
              onPress={() =>
                router.push(
                  `/plate/${encodeURIComponent(sighting.licensePlate)}` as any,
                )
              }
              style={({pressed}) => [
                styles.trackBtn,
                {opacity: pressed ? 0.85 : 1},
              ]}
            >
              <Text style={styles.trackBtnText}>Track This Plate →</Text>
            </Pressable>

            <Text style={styles.timestamp}>
              Reported {new Date(sighting.createdAt).toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  contentWrap: {
    width: '100%',
    alignSelf: 'center',
  },
  contentWrapDesktop: {
    width: 'min(1100px, 96%)' as any,
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
  headerTitle: {
    color: '#edf5ff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Unbounded',
  },
  shareBtn: {
    color: '#56CCFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },

  photo: {
    width: '100%',
    height: 320,
    backgroundColor: '#0d1526',
    borderRadius: 20,
  },
  photoDesktop: {height: 380},
  photoAgencyBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  photoAgencyText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
  },
  confirmedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(34,197,94,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  confirmedText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
  },

  body: {padding: 16, gap: 16},
  bodyDesktop: {paddingHorizontal: 4, paddingTop: 18},

  plateSection: {alignItems: 'center'},
  plateText: {
    color: '#f3f8ff',
    fontSize: 32,
    fontWeight: '800',
    fontFamily: 'Unbounded',
    letterSpacing: 1.3,
  },
  vehicleSubtitle: {
    color: '#9cb0d3',
    fontSize: 13,
    marginTop: 6,
    fontFamily: 'JetBrains Mono',
  },

  credPanel: {
    backgroundColor: 'rgba(12,20,36,0.84)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  credPanelTitle: {
    color: '#a8bbda',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'JetBrains Mono',
  },
  credScore: {fontSize: 24, fontWeight: '800', fontFamily: 'Unbounded'},
  credBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 6,
  },
  credBarFill: {height: 6, borderRadius: 3},
  credLabel: {fontSize: 12, fontWeight: '700', marginBottom: 8},
  voteCountRow: {flexDirection: 'row', gap: 12},
  voteCount: {color: '#8ea2c6', fontSize: 12, fontFamily: 'JetBrains Mono'},
  confirmedPill: {
    marginTop: 10,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    alignSelf: 'flex-start',
  },
  confirmedPillText: {color: '#22C55E', fontSize: 12, fontWeight: '700'},

  voteRow: {flexDirection: 'row', gap: 8},
  voteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  voteBtnSmall: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  voteBtnText: {
    color: '#cfdef8',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'JetBrains Mono',
  },

  aiPanel: {
    backgroundColor: 'rgba(18,35,62,0.62)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(86,204,255,0.24)',
    gap: 8,
  },
  aiPanelTitle: {
    color: '#56CCFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontFamily: 'JetBrains Mono',
  },
  aiRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  aiLabel: {
    color: '#8ea2c6',
    fontSize: 12,
    fontWeight: '700',
    width: 80,
    fontFamily: 'JetBrains Mono',
  },
  aiValue: {color: '#d5e4fc', fontSize: 12, flex: 1},
  agencyChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  agencyChipText: {fontSize: 12, fontWeight: '800', letterSpacing: 1},

  section: {gap: 6},
  sectionTitle: {
    color: '#edf5ff',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'JetBrains Mono',
  },
  addressText: {color: '#d5e4fc', fontSize: 14},
  coordsText: {color: '#95abd0', fontSize: 12, fontFamily: 'JetBrains Mono'},
  accuracyText: {color: '#8399c0', fontSize: 11, fontFamily: 'JetBrains Mono'},

  notesBox: {
    backgroundColor: 'rgba(12,20,36,0.84)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(129,167,227,0.2)',
  },
  notesText: {color: '#d3e2fb', fontSize: 14, lineHeight: 20},

  trackBtn: {
    backgroundColor: '#1A8CD9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  trackBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
  },

  timestamp: {
    color: '#7f95bd',
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'JetBrains Mono',
  },
})
