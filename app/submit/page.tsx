'use client'

import {ChangeEvent, useEffect, useMemo, useState, useTransition} from 'react'
import {useAction, useMutation} from 'convex/react'
import {actionRef, mutationRef} from '@/lib/convex-refs'
import {getDeviceId} from '@/lib/device-id'

const CAPTURE_KEY = 'ice-watch-capture'

type DraftLocation = {
  latitude: number
  longitude: number
  accuracy?: number
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [prefix, raw] = dataUrl.split(',')
  const mime = prefix.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const binary = atob(raw ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], {type: mime})
}

export default function SubmitPage() {
  const [fromCamera, setFromCamera] = useState(false)

  const [imageDataUrl, setImageDataUrl] = useState<string>('')
  const [licensePlate, setLicensePlate] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [notes, setNotes] = useState('')
  const [location, setLocation] = useState<DraftLocation | null>(null)
  const [status, setStatus] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  const generateUploadUrl = useMutation(mutationRef('files:generateUploadUrl'))
  const registerUpload = useMutation(mutationRef('files:registerUpload'))
  const createSighting = useMutation(mutationRef('sightings:create'))
  const analyzeVehicle = useAction(actionRef('ai:analyzeVehicle'))
  const ingestSighting = useMutation(mutationRef('ragIngest:ingestSighting'))

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setFromCamera(params.get('fromCamera') === '1')
  }, [])

  useEffect(() => {
    if (fromCamera) {
      const raw = window.sessionStorage.getItem(CAPTURE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as {
          dataUrl?: string
          location?: DraftLocation | null
        }
        if (parsed.dataUrl) setImageDataUrl(parsed.dataUrl)
        if (parsed.location) setLocation(parsed.location)
      }
    }
  }, [fromCamera])

  useEffect(() => {
    if (location || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      () => {
        setLocation(null)
      },
      {enableHighAccuracy: true, timeout: 8000},
    )
  }, [location])

  const preview = useMemo(() => {
    if (!imageDataUrl) return null
    return (
      <img
        src={imageDataUrl}
        alt='capture preview'
        style={{width: '100%', borderRadius: 10}}
      />
    )
  }, [imageDataUrl])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        setImageDataUrl(result)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit() {
    if (!imageDataUrl) {
      setStatus('Attach a photo first.')
      return
    }
    if (!location) {
      setStatus('Location unavailable. Enable geolocation and retry.')
      return
    }

    startTransition(async () => {
      setStatus('Preparing upload...')
      const nowMs = Date.now()
      const deviceId = getDeviceId()

      try {
        const blob = dataUrlToBlob(imageDataUrl)
        const upload = await generateUploadUrl({deviceId, nowMs})
        const uploadResponse = await fetch(upload.uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': blob.type || 'image/jpeg',
          },
          body: blob,
        })
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`)
        }
        const uploadPayload = (await uploadResponse.json()) as {
          storageId: string
        }

        const uploadRecord = await registerUpload({
          deviceId,
          fileName: `sighting-${nowMs}.jpg`,
          mimeType: blob.type || 'image/jpeg',
          sizeBytes: blob.size,
          storageId: uploadPayload.storageId,
          nowMs,
        })

        setStatus('Running AI analysis...')
        let aiResult: {
          licensePlate: string
          vehicleMake: string
          vehicleModel: string
          vehicleColor: string
          vehicleType: string
          agencyType: string
          agencyMarkings: string
          badgeNumber: string
          uniformDescription: string
          confidence: number
        } | null = null

        try {
          aiResult = await analyzeVehicle({imageUrl: uploadRecord.fileUrl})
        } catch (error) {
          // AI is optional for submission; continue with manual values.
          console.warn('AI analysis skipped:', error)
        }

        const finalPlate = (licensePlate || aiResult?.licensePlate || '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
        if (!finalPlate) {
          throw new Error('A valid license plate is required.')
        }

        setStatus('Creating sighting...')
        const created = await createSighting({
          licensePlate: finalPlate,
          vehicleType: vehicleType || aiResult?.vehicleType || 'Other',
          photoUrl: uploadRecord.fileUrl,
          latitude: String(location.latitude),
          longitude: String(location.longitude),
          locationAccuracy: location.accuracy
            ? String(location.accuracy)
            : null,
          locationAddress: null,
          notes: notes || null,
          photoMetadata: null,
          deviceId,
          imageStorageId: uploadPayload.storageId,
          agencyType: aiResult?.agencyType || null,
          agencyMarkings: aiResult?.agencyMarkings || null,
          vehicleMake: aiResult?.vehicleMake || null,
          vehicleModel: aiResult?.vehicleModel || null,
          vehicleColor: aiResult?.vehicleColor || null,
          badgeNumber: aiResult?.badgeNumber || null,
          uniformDescription: aiResult?.uniformDescription || null,
          aiConfidence: aiResult ? String(aiResult.confidence ?? 0) : null,
          nowMs: Date.now(),
        })

        try {
          await ingestSighting({
            sightingId: created.id,
            createdByDeviceId: deviceId,
            nowMs: Date.now(),
          })
        } catch (error) {
          console.warn('RAG ingest skipped:', error)
        }

        setStatus(`Submitted successfully. Sighting #${created.id} created.`)
        window.sessionStorage.removeItem(CAPTURE_KEY)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Submission failed'
        setStatus(message)
      }
    })
  }

  return (
    <section className='panel grid'>
      <h1 style={{margin: 0}}>Submit Sighting</h1>
      <p className='muted'>
        Uploads are stored in Convex storage and instantly reflected in realtime
        feeds.
      </p>

      <div className='grid grid-2'>
        <div className='panel'>
          <h3 style={{marginTop: 0}}>Photo</h3>
          <input type='file' accept='image/*' onChange={handleFileChange} />
          <div style={{marginTop: 12}}>{preview}</div>
        </div>

        <div className='panel'>
          <h3 style={{marginTop: 0}}>Details</h3>
          <label>
            License plate
            <input
              value={licensePlate}
              onChange={(event) => setLicensePlate(event.target.value)}
              placeholder='ABC1234'
              autoCapitalize='characters'
            />
          </label>
          <label>
            Vehicle type
            <input
              value={vehicleType}
              onChange={(event) => setVehicleType(event.target.value)}
              placeholder='SUV'
            />
          </label>
          <label>
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
            />
          </label>
          <p className='muted' style={{marginBottom: 0}}>
            {location
              ? `Location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
              : 'Location pending'}
          </p>
        </div>
      </div>

      <div style={{display: 'flex', gap: 8}}>
        <button
          className='button primary'
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? 'Submitting...' : 'Submit Sighting'}
        </button>
      </div>
      {status ? <p className='muted'>{status}</p> : null}
    </section>
  )
}
