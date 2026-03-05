"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { queryRef } from "@/lib/convex-refs";
import { Sighting } from "@/types/domain";

const LeafletMap = dynamic(
  () => import("../../components/leaflet-map").then((mod) => mod.LeafletMap),
  { ssr: false },
);

export default function WidgetPage() {
  const sightings = useQuery(queryRef("sightings:list"), {
    hideHidden: true,
    limit: 400,
  }) as Sighting[] | undefined;

  const markers = useMemo(
    () =>
      (sightings ?? []).map((item) => ({
        id: item.id,
        latitude: Number.parseFloat(item.latitude),
        longitude: Number.parseFloat(item.longitude),
        licensePlate: item.licensePlate,
        vehicleType: item.vehicleType ?? null,
        credibilityScore: item.credibilityScore,
        upvotes: item.upvotes,
        downvotes: item.downvotes,
        agencyType: item.agencyType ?? null,
      })),
    [sightings],
  );

  return (
    <section className="panel" style={{ minHeight: 760, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 1000 }} className="badge">
        Embeddable Realtime Map · {markers.length} markers
      </div>
      <LeafletMap markers={markers} center={[37.7749, -122.4194]} zoom={11} />
    </section>
  );
}
