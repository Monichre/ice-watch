"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { mutationRef, queryRef } from "@/lib/convex-refs";
import { getDeviceId } from "@/lib/device-id";
import { Sighting } from "@/types/domain";

export default function SightingDetailPage() {
  const params = useParams<{ id: string }>();
  const sightingId = Number(params.id);
  const hasValidId = Number.isInteger(sightingId) && sightingId > 0;

  const sighting = useQuery(queryRef("sightings:getById"), hasValidId ? { id: sightingId } : "skip") as
    | Sighting
    | null
    | undefined;
  const vote = useQuery(queryRef("votes:getUserVote"), hasValidId
    ? {
    deviceId: getDeviceId(),
    sightingId,
      }
    : "skip") as { voteType: "upvote" | "downvote" | "flag" } | null | undefined;

  const castVote = useMutation(mutationRef("votes:cast"));
  const removeVote = useMutation(mutationRef("votes:remove"));

  const coords = useMemo(() => {
    if (!sighting) return null;
    const lat = Number.parseFloat(sighting.latitude);
    const lng = Number.parseFloat(sighting.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [sighting]);

  if (!hasValidId) {
    return <section className="panel">Invalid sighting id.</section>;
  }

  if (sighting === undefined) {
    return <section className="panel">Loading sighting...</section>;
  }
  if (!sighting) {
    return <section className="panel">Sighting not found.</section>;
  }

  const voteLabel = vote?.voteType ? `Your vote: ${vote.voteType}` : "No vote yet";

  return (
    <section className="grid grid-2">
      <article className="panel">
        <h1 style={{ marginTop: 0 }}>{sighting.licensePlate}</h1>
        <img src={sighting.photoUrl} alt={`Sighting ${sighting.licensePlate}`} style={{ width: "100%", borderRadius: 12 }} />
        <p className="muted">
          {new Date(sighting.createdAt).toLocaleString()} · Credibility {Number.parseFloat(sighting.credibilityScore).toFixed(1)}
          %
        </p>
        <p>{sighting.notes || "No notes were provided for this report."}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="button"
            onClick={() =>
              castVote({
                deviceId: getDeviceId(),
                sightingId,
                voteType: "upvote",
                nowMs: Date.now(),
              })
            }
          >
            Upvote
          </button>
          <button
            className="button"
            onClick={() =>
              castVote({
                deviceId: getDeviceId(),
                sightingId,
                voteType: "downvote",
                nowMs: Date.now(),
              })
            }
          >
            Downvote
          </button>
          <button
            className="button"
            onClick={() =>
              removeVote({
                deviceId: getDeviceId(),
                sightingId,
                nowMs: Date.now(),
              })
            }
          >
            Remove Vote
          </button>
          <span className="badge">{voteLabel}</span>
        </div>
      </article>

      <article className="panel">
        <h3 style={{ marginTop: 0 }}>Structured Metadata</h3>
        <div className="grid">
          <p className="muted">Vehicle: {sighting.vehicleMake || "unknown"} {sighting.vehicleModel || ""}</p>
          <p className="muted">Color: {sighting.vehicleColor || "unknown"}</p>
          <p className="muted">Agency: {sighting.agencyType || "none"}</p>
          <p className="muted">Badge: {sighting.badgeNumber || "not visible"}</p>
          <p className="muted">Uniform: {sighting.uniformDescription || "not provided"}</p>
          <p className="muted">Address: {sighting.locationAddress || "not resolved"}</p>
          <p className="muted">Coordinates: {sighting.latitude}, {sighting.longitude}</p>
          {coords ? (
            <Link
              className="button primary"
              href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
              target="_blank"
            >
              Open in Maps
            </Link>
          ) : null}
          <Link className="button" href={`/plate/${encodeURIComponent(sighting.licensePlate)}`}>
            View Plate Timeline
          </Link>
        </div>
      </article>
    </section>
  );
}
