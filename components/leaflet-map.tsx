import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
// Note: leaflet.heat is loaded via CDN script tag at runtime to avoid bundler issues

type MarkerData = {
  id: number;
  latitude: number;
  longitude: number;
  licensePlate: string;
  vehicleType: string | null;
  credibilityScore: string;
  upvotes: number;
  downvotes: number;
  agencyType?: string | null;
  isRecent?: boolean; // sighted in last 10 minutes
};

interface LeafletMapProps {
  markers: MarkerData[];
  center: [number, number];
  zoom?: number;
  onMarkerClick?: (marker: MarkerData) => void;
  showUserLocation?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
  showHeatmap?: boolean;
}

// Agency color map
const AGENCY_COLORS: Record<string, string> = {
  ICE: "#EF4444",
  CBP: "#F59E0B",
  DHS: "#8B5CF6",
  FBI: "#3B82F6",
  DEA: "#10B981",
  ATF: "#F97316",
  USMS: "#EC4899",
  Other: "#6B7280",
};

function getAgencyColor(agencyType: string | null | undefined, credibility: number): string {
  if (agencyType && AGENCY_COLORS[agencyType]) return AGENCY_COLORS[agencyType];
  if (credibility >= 70) return "#22C55E";
  if (credibility >= 40) return "#F59E0B";
  return "#EF4444";
}

function buildMarkerHtml(markerData: MarkerData, isRecent: boolean): string {
  const credibility = parseFloat(markerData.credibilityScore);
  const color = getAgencyColor(markerData.agencyType, credibility);
  const agency = markerData.agencyType || "";
  const label = agency.length > 0 ? agency.substring(0, 3) : credibility.toFixed(0);

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
    : "";

  return `
    <div style="position: relative; width: 30px; height: 30px;">
      ${pulseStyle}
      <div style="
        width: 30px;
        height: 30px;
        background: linear-gradient(135deg, ${color}dd, ${color});
        border: 2.5px solid rgba(255,255,255,0.9);
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5), 0 0 0 1px ${color}55;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 800;
        font-size: 8px;
        font-family: monospace;
        letter-spacing: 0.5px;
        position: relative;
        z-index: 1;
      ">
        ${label}
      </div>
    </div>
  `;
}

function buildPopupHtml(markerData: MarkerData): string {
  const credibility = parseFloat(markerData.credibilityScore);
  const color = getAgencyColor(markerData.agencyType, credibility);
  return `
    <div style="
      min-width: 180px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      border-radius: 8px;
      padding: 2px;
    ">
      <div style="font-weight: 800; font-size: 18px; font-family: monospace; color: #fff; margin-bottom: 4px; letter-spacing: 1px;">
        ${markerData.licensePlate}
      </div>
      ${markerData.agencyType ? `<div style="display:inline-block; background:${color}33; color:${color}; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; margin-bottom:6px;">${markerData.agencyType}</div>` : ""}
      ${markerData.vehicleType ? `<div style="font-size:12px; color:#aaa; margin-bottom:4px;">${markerData.vehicleType}</div>` : ""}
      <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
        <div style="
          width: 8px; height: 8px; border-radius: 50%;
          background: ${color};
          box-shadow: 0 0 6px ${color};
        "></div>
        <span style="font-size:12px; color:${color}; font-weight:600;">${credibility.toFixed(0)}% Verified</span>
        <span style="font-size:11px; color:#666;">·</span>
        <span style="font-size:11px; color:#888;">${markerData.upvotes + markerData.downvotes} votes</span>
      </div>
    </div>
  `;
}

const PULSE_CSS = `
  @keyframes pulse-ring {
    0% { transform: scale(0.8); opacity: 0.8; }
    80% { transform: scale(1.8); opacity: 0; }
    100% { transform: scale(1.8); opacity: 0; }
  }
  .leaflet-popup-content-wrapper {
    background: #1a1a2e !important;
    border: 1px solid #333 !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
    border-radius: 10px !important;
    padding: 12px !important;
  }
  .leaflet-popup-tip {
    background: #1a1a2e !important;
  }
  .leaflet-popup-content {
    margin: 0 !important;
    color: #e0e0e0;
  }
  .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
    background-color: rgba(239,68,68,0.2) !important;
  }
  .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
    background-color: rgba(239,68,68,0.7) !important;
    color: white !important;
    font-weight: 700 !important;
  }
`;

export function LeafletMap({
  markers,
  center,
  zoom = 13,
  onMarkerClick,
  showUserLocation,
  userLocation,
  showHeatmap = false,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!isClient || !mapContainerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    // Inject pulse CSS
    if (!document.getElementById("leaflet-pulse-css")) {
      const style = document.createElement("style");
      style.id = "leaflet-pulse-css";
      style.textContent = PULSE_CSS;
      document.head.appendChild(style);
    }

    // Must load Leaflet first and assign to globalThis before loading plugins
    import("leaflet").then(async (leafletMod) => {
      const L = (leafletMod as any).default || leafletMod;
      // Assign to global so Leaflet plugins can find it
      (globalThis as any).L = L;
      (globalThis as any).Leaflet = L;
      // Now safe to load plugins that depend on global L
      await import("leaflet.markercluster");
      LRef.current = L;

      // Fix default icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current!, {
        zoomControl: false,
        attributionControl: true,
      }).setView(center, zoom);

      // Dark tile layer (CartoDB Dark Matter)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      // Custom zoom control (bottom right)
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Marker cluster group
      const clusterGroup = (L as any).markerClusterGroup({
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `
              <div style="
                width: 40px; height: 40px;
                background: rgba(239,68,68,0.85);
                border: 2px solid rgba(255,255,255,0.8);
                border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                color: white; font-weight: 800; font-size: 13px;
                box-shadow: 0 2px 12px rgba(239,68,68,0.5);
              ">${count}</div>
            `,
            className: "custom-cluster-icon",
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });
        },
      });

      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;
      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [isClient]);

  // Update markers when data changes
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!mapReady || !L || !map || !clusterGroup) return;

    clusterGroup.clearLayers();

    const now = Date.now();

    markers.forEach((markerData) => {
      const isRecent = markerData.isRecent ?? false;

      const icon = L.divIcon({
        className: "",
        html: buildMarkerHtml(markerData, isRecent),
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -18],
      });

      const leafletMarker = L.marker([markerData.latitude, markerData.longitude], { icon });

      leafletMarker.bindPopup(buildPopupHtml(markerData), {
        className: "dark-popup",
        maxWidth: 220,
      });

      leafletMarker.on("click", () => {
        if (onMarkerClick) onMarkerClick(markerData);
      });

      clusterGroup.addLayer(leafletMarker);
    });

    // Heatmap layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    if (showHeatmap && markers.length > 0) {
      // Dynamically load leaflet.heat via script tag to avoid bundler issues
      const loadHeat = () => new Promise<void>((resolve, reject) => {
        if ((L as any).heatLayer) { resolve(); return; }
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });
      loadHeat().then(() => {
        const points = markers.map((m) => [
          m.latitude,
          m.longitude,
          parseFloat(m.credibilityScore) / 100,
        ]);
        heatLayerRef.current = (L as any).heatLayer(points, {
          radius: 35,
          blur: 25,
          maxZoom: 17,
          gradient: { 0.2: "#3B82F6", 0.5: "#F59E0B", 0.8: "#EF4444" },
        }).addTo(map);
      }).catch(() => { /* skip if unavailable */ });
    }
  }, [markers, showHeatmap, onMarkerClick, mapReady]);

  // Update user location marker
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (showUserLocation && userLocation) {
      const userIcon = L.divIcon({
        className: "",
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
      });

      userMarkerRef.current = L.marker(
        [userLocation.latitude, userLocation.longitude],
        { icon: userIcon, zIndexOffset: 1000 }
      )
        .bindPopup('<span style="color:#3B82F6; font-weight:700;">Your Location</span>')
        .addTo(map);
    }
  }, [showUserLocation, userLocation]);

  // Pan map to user location when it first becomes available
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    map.setView([userLocation.latitude, userLocation.longitude], 14, { animate: true });
  }, [userLocation?.latitude, userLocation?.longitude]);

  if (!isClient) {
    return (
      <div style={{
        width: "100%", height: "100%",
        background: "#0d0d1a",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: "#666", fontSize: 14 }}>Loading map…</div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "#0d0d1a",
      }}
    />
  );
}
