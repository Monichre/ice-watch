/**
 * Embeddable Map Widget
 *
 * A minimal, iframe-embeddable version of the ICE Tracker map.
 * Embed with: <iframe src="https://your-domain/widget" width="100%" height="400"></iframe>
 */

import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { trpc } from "@/lib/trpc";

export default function WidgetScreen() {
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [markerCount, setMarkerCount] = useState(0);

  const { data: sightings } = trpc.sightings.list.useQuery(
    { limit: 200, hideHidden: true },
    { refetchInterval: 15000 }
  );

  // Initialize Leaflet map
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (mapRef.current) return;

    const container = document.getElementById("widget-map");
    if (!container) return;

    (async () => {
      const L = (await import("leaflet")).default;
      (window as any).L = L;

      // Load CSS
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const map = L.map(container, {
        zoomControl: true,
        attributionControl: false,
      }).setView([37.7749, -122.4194], 11);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 }
      ).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    })();
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapReady || !mapRef.current || !sightings || Platform.OS !== "web") return;

    const L = (window as any).L;
    if (!L) return;

    // Clear existing markers
    mapRef.current.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        mapRef.current.removeLayer(layer);
      }
    });

    const AGENCY_COLORS: Record<string, string> = {
      ICE: "#EF4444", CBP: "#F59E0B", DHS: "#8B5CF6",
      FBI: "#3B82F6", DEA: "#10B981", ATF: "#F97316",
      USMS: "#EC4899", Other: "#6B7280",
    };

    let count = 0;
    for (const s of sightings as any[]) {
      const lat = parseFloat(s.latitude);
      const lng = parseFloat(s.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;

      const agency = (s.agencyType as string) || "Other";
      const color = AGENCY_COLORS[agency] || "#6B7280";
      const cred = parseFloat(s.credibilityScore);

      const marker = L.circleMarker([lat, lng], {
        radius: 7,
        fillColor: color,
        color: "#fff",
        weight: 1.5,
        opacity: 1,
        fillOpacity: cred >= 50 ? 0.9 : 0.5,
      }).addTo(mapRef.current);

      const timeAgo = (d: string) => {
        const diff = Date.now() - new Date(d).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
      };

      marker.bindPopup(
        `<div style="font-family:monospace;font-size:13px;color:#fff;background:#1a1a2e;padding:8px;border-radius:6px;min-width:160px">
          <div style="font-size:16px;font-weight:bold;color:${color}">${s.licensePlate}</div>
          ${agency !== "Other" ? `<div style="color:${color};font-size:11px">${agency}</div>` : ""}
          <div style="color:#aaa;font-size:11px;margin-top:4px">${timeAgo(s.createdAt)}</div>
          ${s.locationAddress ? `<div style="color:#ccc;font-size:11px;margin-top:2px">${s.locationAddress}</div>` : ""}
          <a href="/sighting/${s.id}" style="color:#3B82F6;font-size:11px;display:block;margin-top:6px">View details →</a>
        </div>`,
        { className: "dark-popup" }
      );

      count++;
    }
    setMarkerCount(count);
  }, [sightings, mapReady]);

  if (Platform.OS !== "web") {
    return (
      <View style={styles.container}>
        <Text style={styles.notSupported}>Widget only available on web</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Inject dark popup CSS */}
      {typeof document !== "undefined" && (() => {
        if (!document.getElementById("widget-popup-css")) {
          const style = document.createElement("style");
          style.id = "widget-popup-css";
          style.textContent = `.dark-popup .leaflet-popup-content-wrapper { background: #1a1a2e; border: 1px solid #334155; box-shadow: 0 4px 20px rgba(0,0,0,0.5); } .dark-popup .leaflet-popup-tip { background: #1a1a2e; }`;
          document.head.appendChild(style);
        }
        return null;
      })()}

      {/* Map container */}
      <div
        id="widget-map"
        style={{ width: "100%", height: "100%", background: "#0d0d1a" }}
      />

      {/* Overlay badge */}
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.badgeText}>🛰 ICE TRACKER</Text>
        <Text style={styles.badgeCount}>{markerCount} active</Text>
      </View>

      {/* Attribution */}
      <View style={styles.attribution} pointerEvents="none">
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d1a",
    position: "relative",
  },
  notSupported: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(13,13,26,0.85)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.4)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badgeText: {
    color: "#3B82F6",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  badgeCount: {
    color: "#aaa",
    fontSize: 11,
  },
  attribution: {
    position: "absolute",
    bottom: 4,
    right: 8,
  },
  attributionText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 9,
  },
});
