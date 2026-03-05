"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { queryRef } from "@/lib/convex-refs";
import { Sighting } from "@/types/domain";

const LeafletMap = dynamic(
  () => import("../components/leaflet-map").then((mod) => mod.LeafletMap),
  { ssr: false },
);

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
  isRecent?: boolean;
};

function toMarkers(sightings: Sighting[]): MarkerData[] {
  const now = Date.now();
  return sightings.map((sighting) => ({
    id: sighting.id,
    latitude: Number.parseFloat(sighting.latitude),
    longitude: Number.parseFloat(sighting.longitude),
    licensePlate: sighting.licensePlate,
    vehicleType: sighting.vehicleType ?? null,
    credibilityScore: sighting.credibilityScore,
    upvotes: sighting.upvotes,
    downvotes: sighting.downvotes,
    agencyType: sighting.agencyType ?? null,
    isRecent: now - sighting.createdAt < 10 * 60 * 1000,
  }));
}

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const sightings = useQuery(queryRef("sightings:list"), {
    hideHidden: true,
    limit: 500,
    normalizedPlate: search || undefined,
  }) as Sighting[] | undefined;

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => {
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    });
  }, []);

  const markers = useMemo(() => toMarkers(sightings ?? []), [sightings]);
  const center = userLocation ? [userLocation.latitude, userLocation.longitude] : [37.7749, -122.4194];
  const avgCred = useMemo(() => {
    if (markers.length === 0) return 0;
    return (
      markers.reduce((sum, marker) => sum + Number.parseFloat(marker.credibilityScore), 0) / markers.length
    );
  }, [markers]);

  return (
    <section className="grid grid-2">
      <div className="panel" style={{ minHeight: 720, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 14, left: 14, right: 14, zIndex: 2000 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search plate"
              style={{ maxWidth: 260 }}
            />
            <span className="badge">{markers.length} active markers</span>
          </div>
        </div>
        <LeafletMap
          markers={markers}
          center={center as [number, number]}
          zoom={13}
          showUserLocation
          userLocation={userLocation}
          onMarkerClick={setSelectedMarker}
        />
      </div>

      <div className="grid" style={{ alignContent: "start" }}>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>Realtime Stats</h2>
          <p className="muted">Convex subscriptions update this view as new sightings arrive.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>
                Sightings
              </div>
              <strong style={{ fontSize: 26 }}>{markers.length}</strong>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>
                Avg Credibility
              </div>
              <strong style={{ fontSize: 26 }}>{avgCred.toFixed(0)}%</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <h3 style={{ marginTop: 0 }}>Selected Marker</h3>
          {!selectedMarker ? (
            <p className="muted">Click a map marker to inspect details.</p>
          ) : (
            <div className="grid">
              <strong style={{ fontSize: 20 }}>{selectedMarker.licensePlate}</strong>
              <p className="muted" style={{ margin: 0 }}>
                {selectedMarker.vehicleType ?? "Unknown vehicle type"}
              </p>
              <p className="muted" style={{ margin: 0 }}>
                Credibility: {Number.parseFloat(selectedMarker.credibilityScore).toFixed(0)}% · Votes:{" "}
                {selectedMarker.upvotes + selectedMarker.downvotes}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <Link className="button" href={`/sighting/${selectedMarker.id}`}>
                  Open Sighting
                </Link>
                <Link className="button primary" href={`/plate/${encodeURIComponent(selectedMarker.licensePlate)}`}>
                  Track Plate
                </Link>
              </div>
            </div>
          )}
        </article>

        <article className="panel">
          <h3 style={{ marginTop: 0 }}>Quick Actions</h3>
          <div style={{ display: "grid", gap: 8 }}>
            <Link href="/camera" className="button">
              Capture New Sighting
            </Link>
            <Link href="/submit" className="button">
              Submit Manually
            </Link>
            <Link href="/sightings" className="button">
              Open Reports Feed
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
