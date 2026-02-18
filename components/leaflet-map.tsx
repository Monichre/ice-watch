import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type MarkerData = {
  id: number;
  latitude: number;
  longitude: number;
  licensePlate: string;
  vehicleType: string | null;
  credibilityScore: string;
  upvotes: number;
  downvotes: number;
};

interface LeafletMapProps {
  markers: MarkerData[];
  center: [number, number];
  zoom?: number;
  onMarkerClick?: (marker: MarkerData) => void;
  showUserLocation?: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
}

export function LeafletMap({
  markers,
  center,
  zoom = 13,
  onMarkerClick,
  showUserLocation,
  userLocation,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !mapContainerRef.current || mapInstance) return;

    // Dynamically import Leaflet only on client side
    import("leaflet").then((leaflet) => {
      setL(leaflet.default);

      // Fix for default marker icons
      delete (leaflet.default.Icon.Default.prototype as any)._getIconUrl;
      leaflet.default.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      // Initialize map
      const map = leaflet.default.map(mapContainerRef.current!).setView(center, zoom);

      leaflet.default.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      setMapInstance(map);
    });

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [isClient]);

  useEffect(() => {
    if (!mapInstance || !L) return;

    // Clear existing layers
    mapInstance.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        mapInstance.removeLayer(layer);
      }
    });

    // Add markers
    markers.forEach((markerData) => {
      const credibility = parseFloat(markerData.credibilityScore);
      const color = credibility >= 70 ? "#22C55E" : credibility >= 40 ? "#F59E0B" : "#EF4444";

      const icon = L.divIcon({
        className: "custom-marker",
        html: `
          <div style="
            width: 30px;
            height: 30px;
            background-color: ${color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 10px;
          ">
            ${credibility.toFixed(0)}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([markerData.latitude, markerData.longitude], { icon });

      marker.bindPopup(`
        <div style="min-width: 150px;">
          <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px; font-family: monospace;">
            ${markerData.licensePlate}
          </div>
          ${markerData.vehicleType ? `<div style="font-size: 12px; color: #666; margin-bottom: 4px;">${markerData.vehicleType}</div>` : ""}
          <div style="font-size: 12px; color: ${color}; font-weight: 600;">
            ${credibility.toFixed(0)}% Verified
          </div>
          <div style="font-size: 11px; color: #999; margin-top: 4px;">
            ${markerData.upvotes + markerData.downvotes} votes
          </div>
        </div>
      `);

      marker.on("click", () => {
        if (onMarkerClick) {
          onMarkerClick(markerData);
        }
      });

      marker.addTo(mapInstance);
    });

    // Add user location marker if available
    if (showUserLocation && userLocation) {
      const userIcon = L.divIcon({
        className: "user-location-marker",
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background-color: #0a7ea4;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon })
        .bindPopup("Your Location")
        .addTo(mapInstance);
    }
  }, [markers, showUserLocation, userLocation, onMarkerClick, mapInstance, L]);

  if (!isClient) {
    return <div style={{ width: "100%", height: "100%", backgroundColor: "#f0f0f0" }} />;
  }

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    />
  );
}
