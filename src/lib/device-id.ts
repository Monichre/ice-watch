const DEVICE_ID_KEY = "ice-watch-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "server-device";
  }
  const cached = window.localStorage.getItem(DEVICE_ID_KEY);
  if (cached) {
    return cached;
  }
  const generated = window.crypto?.randomUUID?.() ?? `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}
