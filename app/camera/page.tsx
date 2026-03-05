"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const CAPTURE_KEY = "ice-watch-capture";

export default function CameraPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function setup() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Failed to open camera";
        setError(message);
      }
    }
    setup();
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    const location = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        enableHighAccuracy: true,
        timeout: 8000,
      });
    });

    window.sessionStorage.setItem(
      CAPTURE_KEY,
      JSON.stringify({
        dataUrl,
        createdAt: Date.now(),
        location: location
          ? {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
            }
          : null,
      }),
    );
    router.push("/submit?fromCamera=1");
  };

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Camera Capture</h1>
      <p className="muted">Capture a plate photo and auto-forward to the submit workflow.</p>
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(145, 167, 204, 0.2)" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", minHeight: 420, background: "#050a12" }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="button primary" onClick={handleCapture}>
          Capture & Continue
        </button>
        <button className="button" onClick={() => router.push("/")}>
          Cancel
        </button>
      </div>
    </section>
  );
}
