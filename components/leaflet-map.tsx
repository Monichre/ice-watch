"use client";

import {useEffect, useRef, useState} from 'react'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
// Note: leaflet.heat is loaded via CDN script tag at runtime to avoid bundler issues

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
  isRecent?: boolean // sighted in last 10 minutes
}

interface LeafletMapProps {
  markers: MarkerData[]
  center: [number, number]
  zoom?: number
  onMarkerClick?: (marker: MarkerData) => void
  showUserLocation?: boolean
  userLocation?: {latitude: number; longitude: number} | null
  showHeatmap?: boolean
}

// Agency color map
const AGENCY_COLORS: Record<string, string> = {
  ICE: '#FF667D',
  CBP: '#FFB647',
  DHS: '#A58CFF',
  FBI: '#56CCFF',
  DEA: '#2DE1A6',
  ATF: '#F88C47',
  USMS: '#FF8AD0',
  Other: '#8A9CC2',
}

function getAgencyColor(
  agencyType: string | null | undefined,
  credibility: number,
): string {
  if (agencyType && AGENCY_COLORS[agencyType]) return AGENCY_COLORS[agencyType]
  if (credibility >= 70) return '#22C55E'
  if (credibility >= 40) return '#F59E0B'
  return '#EF4444'
}

function buildMarkerHtml(markerData: MarkerData, isRecent: boolean): string {
  const credibility = parseFloat(markerData.credibilityScore)
  const color = getAgencyColor(markerData.agencyType, credibility)
  const agency = markerData.agencyType || ''
  const label =
    agency.length > 0 ? agency.substring(0, 3) : credibility.toFixed(0)

  const pulseStyle = isRecent
    ? `
      <div style="
        position: absolute;
        top: -8px; left: -8px;
        width: 46px; height: 46px;
        border-radius: 50%;
        background: ${color}33;
        animation: pulse-ring 1.8s ease-out infinite;
        pointer-events: none;
      "></div>
    `
    : ''

  return `
    <div style="position: relative; width: 34px; height: 34px;">
      ${pulseStyle}
      <div style="
        width: 34px;
        height: 34px;
        background: linear-gradient(140deg, ${color}, #101826);
        border: 2px solid rgba(224,238,255,0.9);
        border-radius: 50%;
        box-shadow: 0 8px 20px rgba(2,8,20,0.62), 0 0 0 1px ${color}66;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #f7fbff;
        font-weight: 800;
        font-size: 9px;
        font-family: 'JetBrains Mono', monospace;
        letter-spacing: 0.5px;
        position: relative;
        z-index: 1;
      ">
        ${label}
      </div>
    </div>
  `
}

function buildPopupHtml(markerData: MarkerData): string {
  const credibility = parseFloat(markerData.credibilityScore)
  const color = getAgencyColor(markerData.agencyType, credibility)
  return `
    <div style="
      min-width: 196px;
      font-family: 'Manrope', -apple-system, sans-serif;
      background: linear-gradient(165deg, rgba(14,22,38,0.98), rgba(9,15,28,0.97));
      color: #eaf2ff;
      border-radius: 12px;
      border: 1px solid rgba(133,168,223,0.28);
      padding: 10px;
    ">
      <div style="font-weight: 800; font-size: 18px; font-family: 'JetBrains Mono', monospace; color: #f3f8ff; margin-bottom: 6px; letter-spacing: 1px;">
        ${markerData.licensePlate}
      </div>
      ${markerData.agencyType ? `<div style="display:inline-block; background:${color}2A; color:${color}; font-size:11px; font-weight:700; padding:3px 9px; border-radius:999px; margin-bottom:7px; border:1px solid ${color}55;">${markerData.agencyType}</div>` : ''}
      ${markerData.vehicleType ? `<div style="font-size:12px; color:#9db0d1; margin-bottom:6px;">${markerData.vehicleType}</div>` : ''}
      <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
        <div style="
          width: 8px; height: 8px; border-radius: 50%;
          background: ${color};
          box-shadow: 0 0 6px ${color};
        "></div>
        <span style="font-size:12px; color:${color}; font-weight:700;">${credibility.toFixed(0)}% Verified</span>
        <span style="font-size:11px; color:#526385;">·</span>
        <span style="font-size:11px; color:#8fa3c6;">${markerData.upvotes + markerData.downvotes} votes</span>
      </div>
    </div>
  `
}

const PULSE_CSS = `
  @keyframes pulse-ring {
    0% { transform: scale(0.8); opacity: 0.8; }
    80% { transform: scale(1.8); opacity: 0; }
    100% { transform: scale(1.8); opacity: 0; }
  }
  .leaflet-popup-content-wrapper {
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
    border-radius: 12px !important;
    padding: 0 !important;
  }
  .leaflet-popup-tip {
    background: #0a1322 !important;
  }
  .leaflet-popup-content {
    margin: 0 !important;
    color: #e0e0e0;
  }
  .leaflet-control-zoom {
    border: 1px solid rgba(145,176,228,0.25) !important;
    border-radius: 14px !important;
    overflow: hidden !important;
    box-shadow: 0 10px 20px rgba(2,8,20,0.45) !important;
  }
  .leaflet-control-zoom a {
    background: rgba(9,15,28,0.88) !important;
    color: #b8cbeb !important;
    border-bottom: 1px solid rgba(145,176,228,0.2) !important;
  }
  .leaflet-control-attribution {
    background: rgba(9,15,28,0.65) !important;
    border: 1px solid rgba(145,176,228,0.18) !important;
    border-radius: 10px !important;
    color: #9ab0d6 !important;
    margin: 8px !important;
    backdrop-filter: blur(10px);
  }
  .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
    background-color: rgba(86,204,255,0.24) !important;
  }
  .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
    background-color: rgba(23,157,228,0.76) !important;
    color: #f4f9ff !important;
    font-weight: 700 !important;
  }
`

export function LeafletMap({
  markers,
  center,
  zoom = 13,
  onMarkerClick,
  showUserLocation,
  userLocation,
  showHeatmap = false,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [isClient, setIsClient] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<any>(null)
  const LRef = useRef<any>(null)
  const clusterGroupRef = useRef<any>(null)
  const heatLayerRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Initialize map once.
  useEffect(() => {
    if (!isClient || !mapContainerRef.current || initializedRef.current) return
    initializedRef.current = true

    // Inject pulse CSS
    if (!document.getElementById('leaflet-pulse-css')) {
      const style = document.createElement('style')
      style.id = 'leaflet-pulse-css'
      style.textContent = PULSE_CSS
      document.head.appendChild(style)
    }

    // Must load Leaflet first and assign to globalThis before loading plugins
    import('leaflet').then(async (leafletMod) => {
      const L = (leafletMod as any).default || leafletMod
      // Assign to global so Leaflet plugins can find it
      ;(globalThis as any).L = L
      ;(globalThis as any).Leaflet = L
      // Now safe to load plugins that depend on global L
      await import('leaflet.markercluster')
      LRef.current = L

      // Fix default icons
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const map = L.map(mapContainerRef.current!, {
        zoomControl: false,
        attributionControl: true,
      }).setView(center, zoom)

      // Dark tile layer (CartoDB Dark Matter)
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20,
        },
      ).addTo(map)

      // Custom zoom control (bottom right)
      L.control.zoom({position: 'bottomright'}).addTo(map)

      // Marker cluster group
      const clusterGroup = (L as any).markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount()
          return L.divIcon({
            html: `
              <div style="
                width: 40px; height: 40px;
                background: radial-gradient(circle at 30% 25%, rgba(121,225,255,0.95), rgba(18,122,201,0.88));
                border: 2px solid rgba(216,237,255,0.88);
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                color: #f7fcff; font-weight: 800; font-size: 13px;
                box-shadow: 0 10px 22px rgba(5,45,90,0.58);
              ">${count}</div>
            `,
            className: 'custom-cluster-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })
        },
      })

      map.addLayer(clusterGroup)
      clusterGroupRef.current = clusterGroup
      mapRef.current = map
      setMapReady(true)
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        initializedRef.current = false
      }
    }
  }, [isClient]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when data changes
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    const clusterGroup = clusterGroupRef.current
    if (!mapReady || !L || !map || !clusterGroup) return

    clusterGroup.clearLayers()

    markers.forEach((markerData) => {
      const isRecent = markerData.isRecent ?? false

      const icon = L.divIcon({
        className: '',
        html: buildMarkerHtml(markerData, isRecent),
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -18],
      })

      const leafletMarker = L.marker(
        [markerData.latitude, markerData.longitude],
        {icon},
      )

      leafletMarker.bindPopup(buildPopupHtml(markerData), {
        className: 'dark-popup',
        maxWidth: 220,
      })

      leafletMarker.on('click', () => {
        if (onMarkerClick) onMarkerClick(markerData)
      })

      clusterGroup.addLayer(leafletMarker)
    })

    // Heatmap layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current)
      heatLayerRef.current = null
    }
    if (showHeatmap && markers.length > 0) {
      // Dynamically load leaflet.heat via script tag to avoid bundler issues
      const loadHeat = () =>
        new Promise<void>((resolve, reject) => {
          if ((L as any).heatLayer) {
            resolve()
            return
          }
          const script = document.createElement('script')
          script.src =
            'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js'
          script.onload = () => resolve()
          script.onerror = reject
          document.head.appendChild(script)
        })
      loadHeat()
        .then(() => {
          const points = markers.map((m) => [
            m.latitude,
            m.longitude,
            parseFloat(m.credibilityScore) / 100,
          ])
          heatLayerRef.current = (L as any)
            .heatLayer(points, {
              radius: 35,
              blur: 25,
              maxZoom: 17,
              gradient: {0.2: '#3B82F6', 0.5: '#F59E0B', 0.8: '#EF4444'},
            })
            .addTo(map)
        })
        .catch(() => {
          /* skip if unavailable */
        })
    }
  }, [markers, showHeatmap, onMarkerClick, mapReady])

  // Update user location marker
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!mapReady || !L || !map) return

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current)
      userMarkerRef.current = null
    }

    if (showUserLocation && userLocation) {
      const userIcon = L.divIcon({
        className: '',
        html: `
          <div style="position: relative; width: 20px; height: 20px;">
            <div style="
              position: absolute; top: -10px; left: -10px;
              width: 40px; height: 40px;
              border-radius: 50%;
              background: rgba(59,130,246,0.25);
              animation: pulse-ring 2s ease-out infinite;
            "></div>
            <div style="
              width: 20px; height: 20px;
              background: #3B82F6;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 10px rgba(59,130,246,0.6);
              position: relative; z-index: 1;
            "></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })

      userMarkerRef.current = L.marker(
        [userLocation.latitude, userLocation.longitude],
        {icon: userIcon, zIndexOffset: 1000},
      )
        .bindPopup(
          '<span style="color:#3B82F6; font-weight:700;">Your Location</span>',
        )
        .addTo(map)
    }
  }, [showUserLocation, userLocation, mapReady])

  // Keep map center/zoom in sync without reinitializing map.
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    map.setView(center, zoom, {animate: false})
  }, [center, zoom, mapReady])

  // Pan map to user location when it first becomes available
  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map || !userLocation) return
    map.setView([userLocation.latitude, userLocation.longitude], 14, {
      animate: true,
    })
  }, [mapReady, userLocation])

  if (!isClient) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(165deg, #070e1b, #050a14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            color: '#9ab0d6',
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          Calibrating map matrix...
        </div>
      </div>
    )
  }

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#060A12',
      }}
    />
  )
}
