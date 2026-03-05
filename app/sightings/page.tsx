"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { mutationRef, queryRef } from "@/lib/convex-refs";
import { getDeviceId } from "@/lib/device-id";
import { Sighting } from "@/types/domain";

type Tab = "recent" | "trending" | "convoys";

export default function SightingsPage() {
  const [tab, setTab] = useState<Tab>("recent");
  const [sort, setSort] = useState<"recent" | "credibility">("recent");
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const sightings = useQuery(queryRef("sightings:list"), {
    hideHidden: true,
    limit: 500,
  }) as Sighting[] | undefined;
  const trending = useQuery(queryRef("trending:plates"), {
    nowMs,
    limit: 20,
    lookbackHours: 24,
  }) as
    | Array<{ plate: string; count: number; lastSeen: number; agencyType: string | null; avgCredibility: number }>
    | undefined;
  const convoys = useQuery(queryRef("convoy:detect"), {
    nowMs,
    radiusKm: 0.5,
    windowMinutes: 15,
    minVehicles: 2,
  }) as
    | Array<{
        centerLat: number;
        centerLon: number;
        vehicleCount: number;
        plates: string[];
        agencies: string[];
        firstSeen: number;
        lastSeen: number;
      }>
    | undefined;

  const castVote = useMutation(mutationRef("votes:cast"));

  const sorted = useMemo(() => {
    const base = [...(sightings ?? [])];
    if (sort === "credibility") {
      base.sort((a, b) => Number.parseFloat(b.credibilityScore) - Number.parseFloat(a.credibilityScore));
      return base;
    }
    base.sort((a, b) => b.createdAt - a.createdAt);
    return base;
  }, [sightings, sort]);

  return (
    <section className="panel">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Sightings Feed</h1>
        {tab === "recent" && (
          <button className="button" onClick={() => setSort((value) => (value === "recent" ? "credibility" : "recent"))}>
            Sort: {sort === "recent" ? "Most recent" : "Most credible"}
          </button>
        )}
      </header>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["recent", "trending", "convoys"] as const).map((value) => (
          <button
            key={value}
            className="button"
            onClick={() => setTab(value)}
            style={tab === value ? { borderColor: "rgba(62, 168, 255, 0.8)", color: "white" } : undefined}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === "recent" && (
        <div className="grid">
          {sorted.map((item) => (
            <article key={item.id} className="panel" style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <strong style={{ fontSize: 19 }}>{item.licensePlate}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {item.vehicleType ?? "Vehicle type unknown"}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span className="badge">Credibility {Number.parseFloat(item.credibilityScore).toFixed(0)}%</span>
                <span className="badge">Votes {item.upvotes + item.downvotes}</span>
                {item.agencyType ? <span className="badge">{item.agencyType}</span> : null}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="button"
                  onClick={() =>
                    castVote({
                      deviceId: getDeviceId(),
                      sightingId: item.id,
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
                      sightingId: item.id,
                      voteType: "downvote",
                      nowMs: Date.now(),
                    })
                  }
                >
                  Downvote
                </button>
                <Link href={`/sighting/${item.id}`} className="button primary">
                  Inspect
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === "trending" && (
        <div className="grid">
          {(trending ?? []).map((item, index) => (
            <article key={`${item.plate}-${index}`} className="panel" style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ fontSize: 18 }}>#{index + 1} · {item.plate}</strong>
                <span className="badge">{item.count} sightings</span>
              </div>
              <p className="muted" style={{ marginBottom: 8 }}>
                Last seen {new Date(item.lastSeen).toLocaleString()} · Avg credibility {item.avgCredibility.toFixed(1)}%
              </p>
              <Link className="button primary" href={`/plate/${encodeURIComponent(item.plate)}`}>
                Open Plate Timeline
              </Link>
            </article>
          ))}
        </div>
      )}

      {tab === "convoys" && (
        <div className="grid">
          {(convoys ?? []).map((item, index) => (
            <article key={`${item.centerLat}-${item.centerLon}-${index}`} className="panel" style={{ padding: 12 }}>
              <strong>{item.vehicleCount} vehicles moving together</strong>
              <p className="muted">
                Window {new Date(item.firstSeen).toLocaleTimeString()} - {new Date(item.lastSeen).toLocaleTimeString()}
              </p>
              <p className="muted">Plates: {item.plates.join(", ")}</p>
              <p className="muted">Agencies: {item.agencies.join(", ") || "unknown"}</p>
            </article>
          ))}
          {(convoys ?? []).length === 0 ? <p className="muted">No active convoy detections.</p> : null}
        </div>
      )}
    </section>
  );
}
