"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { mutationRef, queryRef } from "@/lib/convex-refs";
import { getDeviceId } from "@/lib/device-id";
import { haversineKm } from "@/lib/geo";
import { Sighting } from "@/types/domain";

export default function PlateTimelinePage() {
  const params = useParams<{ licensePlate: string }>();
  const plate = decodeURIComponent(params.licensePlate).toUpperCase();
  const deviceId = getDeviceId();

  const [agentQuery, setAgentQuery] = useState("");
  const [agentAnswer, setAgentAnswer] = useState<string>("");

  const sightings = useQuery(queryRef("plates:getByPlate"), {
    licensePlate: plate,
    limit: 500,
  }) as Sighting[] | undefined;
  const watched = useQuery(queryRef("proximity:watchedPlates"), {
    deviceId,
  }) as Array<{ normalizedPlate: string }> | undefined;
  const exportPlate = useQuery(queryRef("export:plateHistory"), {
    licensePlate: plate,
    format: "csv",
  }) as { data: string } | undefined;

  const setWatch = useMutation(mutationRef("proximity:upsertWatch"));
  const runAgent = useMutation(mutationRef("agents:runRagAgent"));

  const isWatched = useMemo(() => {
    return Boolean(watched?.some((item) => item.normalizedPlate === plate.replace(/[^A-Z0-9]/g, "")));
  }, [watched, plate]);

  const totalDistance = useMemo(() => {
    const sorted = [...(sightings ?? [])].sort((a, b) => a.createdAt - b.createdAt);
    let distance = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      distance += haversineKm(
        Number.parseFloat(prev.latitude),
        Number.parseFloat(prev.longitude),
        Number.parseFloat(curr.latitude),
        Number.parseFloat(curr.longitude),
      );
    }
    return distance;
  }, [sightings]);

  const handleExport = () => {
    if (!exportPlate?.data) return;
    const blob = new Blob([exportPlate.data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `plate-${plate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="grid grid-2">
      <article className="panel">
        <h1 style={{ marginTop: 0 }}>Plate Timeline: {plate}</h1>
        <p className="muted">
          {(sightings ?? []).length} sightings · {totalDistance.toFixed(1)}km traced
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            className="button"
            onClick={() =>
              setWatch({
                deviceId,
                licensePlate: plate,
                watch: !isWatched,
                nowMs: Date.now(),
              })
            }
          >
            {isWatched ? "Unwatch Plate" : "Watch Plate"}
          </button>
          <button className="button primary" onClick={handleExport}>
            Export CSV
          </button>
        </div>
        <div className="grid">
          {(sightings ?? []).map((item) => (
            <article key={item.id} className="panel" style={{ padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>#{item.id}</strong>
                <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p className="muted" style={{ marginBottom: 6 }}>
                {item.locationAddress || `${item.latitude}, ${item.longitude}`}
              </p>
              <p style={{ margin: 0 }}>{item.notes || "No notes"}</p>
            </article>
          ))}
        </div>
      </article>

      <article className="panel">
        <h3 style={{ marginTop: 0 }}>RAG Agent</h3>
        <p className="muted">Ask contextual questions over ingested sightings/documents.</p>
        <label>
          Agent question
          <textarea
            rows={4}
            value={agentQuery}
            onChange={(event) => setAgentQuery(event.target.value)}
            placeholder="Summarize suspicious movement patterns for this plate."
          />
        </label>
        <div style={{ marginTop: 10 }}>
          <button
            className="button primary"
            onClick={async () => {
              const result = await runAgent({
                query: `${plate}: ${agentQuery}`,
                normalizedPlate: plate,
                nowMs: Date.now(),
              });
              setAgentAnswer(result.answer);
            }}
          >
            Run Agent
          </button>
        </div>
        {agentAnswer ? (
          <pre
            style={{
              marginTop: 12,
              whiteSpace: "pre-wrap",
              background: "rgba(10, 16, 28, 0.9)",
              borderRadius: 12,
              border: "1px solid rgba(145, 167, 204, 0.22)",
              padding: 12,
            }}
          >
            {agentAnswer}
          </pre>
        ) : null}
      </article>
    </section>
  );
}
