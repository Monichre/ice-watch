import {useState, useEffect} from 'react'
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
  useWindowDimensions,
} from 'react-native'
import {router, useLocalSearchParams} from 'expo-router'
// Location API handled by browser Geolocation API
import * as Haptics from 'expo-haptics'
import {ScreenContainer} from '@/components/screen-container'
import {IconSymbol} from '@/components/ui/icon-symbol'
import {useColors} from '@/hooks/use-colors'
import {trpc} from '@/lib/trpc'
import {getDeviceId} from '@/lib/device-id'

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Motorcycle', 'Other']

export default function SubmitScreen() {
  const colors = useColors()
  const {width} = useWindowDimensions()
  const isDesktop = Platform.OS === 'web' && width >= 1040
  const params = useLocalSearchParams()

  const [licensePlate, setLicensePlate] = useState('')
  const [vehicleType, setVehicleType] = useState('SUV')
  const [notes, setNotes] = useState('')
  const [locationAddress, setLocationAddress] = useState('Loading address...')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExtractingPlate, setIsExtractingPlate] = useState(false)
  const [plateConfidence, setPlateConfidence] = useState<number | null>(null)
  const [detectedPlates, setDetectedPlates] = useState<string[]>([])
  const [showPlatePicker, setShowPlatePicker] = useState(false)

  const extractPlateMutation = trpc.alpr.extractPlate.useMutation()

  const photoUri = params.photoUri as string
  const photoBase64 = params.photoBase64 as string
  const latitude = parseFloat(params.latitude as string)
  const longitude = parseFloat(params.longitude as string)
  const locationAccuracy = parseFloat(params.locationAccuracy as string) || 0

  const createSightingMutation = trpc.sightings.create.useMutation()

  useEffect(() => {
    // Use Nominatim for reverse geocoding
    ;(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        )
        const data = await response.json()
        if (data.display_name) {
          setLocationAddress(data.display_name)
        } else {
          setLocationAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
        }
      } catch (error) {
        console.warn('Failed to reverse geocode:', error)
        setLocationAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
      }
    })()
  }, [latitude, longitude])

  // Auto-extract license plate on mount
  useEffect(() => {
    if (!photoUri) return
    ;(async () => {
      setIsExtractingPlate(true)
      try {
        // Use base64 data URL directly for ALPR extraction.
        const dataUrl = `data:image/jpeg;base64,${photoBase64}`

        const result = await extractPlateMutation.mutateAsync({
          imageUrl: dataUrl,
        })

        if (result.plate) {
          setLicensePlate(result.plate)
          setPlateConfidence(result.confidence)
          // Collect all detected plates for multi-plate picker
          const allPlates: string[] = []
          if (result.plate) allPlates.push(result.plate)
          if (
            (result as any).allPlates &&
            Array.isArray((result as any).allPlates)
          ) {
            for (const p of (result as any).allPlates) {
              if (p && !allPlates.includes(p)) allPlates.push(p)
            }
          }
          if (allPlates.length > 1) {
            setDetectedPlates(allPlates)
            setShowPlatePicker(true)
          }
        }
      } catch (error) {
        console.warn('Failed to extract plate:', error)
      } finally {
        setIsExtractingPlate(false)
      }
    })()
  }, [extractPlateMutation, photoBase64, photoUri])

  const handleSubmit = async () => {
    if (!licensePlate.trim()) {
      Alert.alert('Required Field', 'Please enter a license plate number.')
      return
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }

    setIsSubmitting(true)

    try {
      const deviceId = await getDeviceId()

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
      })

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }

      Alert.alert(
        'Success!',
        'Vehicle sighting has been submitted to the network.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/')
            },
          },
        ],
      )
    } catch (error) {
      console.error('Submit error:', error)
      Alert.alert(
        'Submission Failed',
        'Failed to submit sighting. Please check your connection and try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    router.back()
  }

  return (
    <ScreenContainer containerClassName='bg-background' webMaxWidth={1200}>
      <ScrollView
        className='flex-1'
        contentContainerStyle={{paddingBottom: 32}}
      >
        {/* Header */}
        <View
          className='flex-row items-center justify-between p-4 border-b border-border'
          style={
            isDesktop
              ? {width: '100%', maxWidth: 860, alignSelf: 'center'}
              : undefined
          }
        >
          <Pressable
            onPress={handleCancel}
            style={(state) => ({opacity: state.pressed ? 0.6 : 1})}
          >
            <IconSymbol
              name='chevron.left'
              size={28}
              color={colors.foreground}
            />
          </Pressable>
          <Text className='text-xl font-bold text-foreground'>
            Submit Sighting
          </Text>
          <View style={{width: 28}} />
        </View>

        <View
          className='p-4 gap-6'
          style={
            isDesktop
              ? {
                  width: '100%',
                  maxWidth: 860,
                  alignSelf: 'center',
                  paddingTop: 20,
                }
              : undefined
          }
        >
          {/* Photo Preview */}
          <View className='items-center'>
            <Image
              source={{uri: photoUri}}
              style={{
                width: '100%',
                height: 240,
                borderRadius: 12,
                backgroundColor: colors.surface,
              }}
              resizeMode='cover'
            />
          </View>

          {/* License Plate Input */}
          <View className='gap-2'>
            <View className='flex-row items-center justify-between'>
              <Text className='text-sm font-semibold text-foreground'>
                License Plate <Text className='text-error'>*</Text>
              </Text>
              {isExtractingPlate && (
                <View className='flex-row items-center gap-2'>
                  <ActivityIndicator size='small' color={colors.primary} />
                  <Text className='text-xs text-muted'>Detecting plate...</Text>
                </View>
              )}
              {plateConfidence !== null && plateConfidence > 0 && (
                <Text className='text-xs text-success'>
                  ✓ Auto-detected ({Math.round(plateConfidence * 100)}%)
                </Text>
              )}
            </View>
            <TextInput
              value={licensePlate}
              onChangeText={(text) => {
                setLicensePlate(text)
                setPlateConfidence(null) // Clear confidence when manually edited
              }}
              placeholder='Enter plate number'
              placeholderTextColor={colors.muted}
              autoCapitalize='characters'
              autoCorrect={false}
              returnKeyType='done'
              className='bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-lg font-mono'
              style={{color: colors.foreground}}
            />
            {plateConfidence !== null && plateConfidence > 0 && (
              <Text className='text-xs text-muted'>
                AI detected this plate. You can edit if incorrect.
              </Text>
            )}
            {/* Multi-plate picker — shown when AI detects more than one plate */}
            {showPlatePicker && detectedPlates.length > 1 && (
              <View
                style={{
                  backgroundColor: 'rgba(59,130,246,0.1)',
                  borderRadius: 8,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(59,130,246,0.3)',
                }}
              >
                <Text
                  style={{
                    color: '#3B82F6',
                    fontSize: 12,
                    fontWeight: '700',
                    marginBottom: 6,
                  }}
                >
                  🔍 Multiple plates detected — tap to select:
                </Text>
                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>
                  {detectedPlates.map((plate) => (
                    <Pressable
                      key={plate}
                      onPress={() => {
                        setLicensePlate(plate)
                        setShowPlatePicker(false)
                      }}
                      style={({pressed}) => ({
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        backgroundColor:
                          licensePlate === plate
                            ? '#3B82F6'
                            : 'rgba(59,130,246,0.2)',
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: licensePlate === plate ? '#fff' : '#3B82F6',
                          fontFamily: 'monospace',
                          fontWeight: '700',
                          fontSize: 14,
                        }}
                      >
                        {plate}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Vehicle Type Picker */}
          <View className='gap-2'>
            <Text className='text-sm font-semibold text-foreground'>
              Vehicle Type
            </Text>
            <View className='flex-row flex-wrap gap-2'>
              {VEHICLE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => {
                    setVehicleType(type)
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    }
                  }}
                  style={(state) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor:
                      vehicleType === type ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor:
                      vehicleType === type ? colors.primary : colors.border,
                    opacity: state.pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: vehicleType === type ? 'white' : colors.foreground,
                      fontWeight: vehicleType === type ? '600' : '400',
                    }}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Location Info */}
          <View className='gap-2'>
            <Text className='text-sm font-semibold text-foreground'>
              Location
            </Text>
            <View className='bg-surface border border-border rounded-lg p-4 gap-2'>
              <Text className='text-foreground'>{locationAddress}</Text>
              <Text className='text-xs text-muted'>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </Text>
              {locationAccuracy > 0 && (
                <Text className='text-xs text-muted'>
                  Accuracy: ±{locationAccuracy.toFixed(0)}m
                </Text>
              )}
            </View>
          </View>

          {/* Notes Input */}
          <View className='gap-2'>
            <Text className='text-sm font-semibold text-foreground'>
              Notes (Optional)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder='Add any additional details...'
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              textAlignVertical='top'
              returnKeyType='done'
              className='bg-surface border border-border rounded-lg px-4 py-3 text-foreground'
              style={{color: colors.foreground, minHeight: 100}}
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
              alignItems: 'center',
              opacity: state.pressed || isSubmitting ? 0.7 : 1,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color='white' />
            ) : (
              <Text className='text-white text-lg font-semibold'>
                Submit to Network
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}
