/**
 * Wraps navigator.geolocation.getCurrentPosition with a tagged result envelope
 * that mirrors the mobile client (`mobile/src/core/services/deviceLocation.ts`)
 * so the proximity-filter UX behaves identically across platforms.
 *
 * Returns one of:
 *   - { status: "granted", coordinates: { latitude, longitude } }
 *   - { status: "denied" }       — user explicitly refused permission
 *   - { status: "unavailable" }  — API missing, timeout, or position lookup failed
 *
 * Coordinates are returned as raw decimal degrees; callers are responsible for
 * any rounding (matches mobile, which truncates to 4 decimals only at display).
 */

const DEFAULT_TIMEOUT_MS = 10000;

export async function getCurrentDeviceCoordinates({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { status: "unavailable" };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: "granted",
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      },
      (error) => {
        if (error && error.code === 1) {
          resolve({ status: "denied" });
          return;
        }
        resolve({ status: "unavailable" });
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}
