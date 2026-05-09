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
 *
 * On a successful grant we also stash the coordinates in sessionStorage so
 * downstream UI (proximity chip, filter panel) can tell whether the active
 * proximity centre was obtained from geolocation in this session or supplied
 * externally (e.g. a map-pin popup link).
 */

const DEFAULT_TIMEOUT_MS = 10000;
const SESSION_STORAGE_KEY = "proximity:lastDeviceCoords";
// ~11 m at the equator — generous enough to accommodate the 4-decimal
// truncation used at display while still distinguishing two pins from
// each other.
const COORD_MATCH_TOLERANCE_DEG = 1e-4;

function safeSessionStorage() {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function storeDeviceCoordinates({ latitude, longitude }) {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ latitude, longitude }),
    );
  } catch {
    // Quota exceeded or storage disabled — degrade silently; the chip will
    // simply fall back to the "selected location" label until next grant.
  }
}

export function getStoredDeviceCoordinates() {
  const storage = safeSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.latitude) || !Number.isFinite(parsed?.longitude)) {
      return null;
    }
    return { latitude: parsed.latitude, longitude: parsed.longitude };
  } catch {
    return null;
  }
}

/**
 * True when the given coordinate pair matches the device coordinates obtained
 * via geolocation earlier in this session, within ~11 m. Returns false if no
 * grant has happened yet, if either input is missing, or if the inputs differ.
 */
export function isProximityFromDeviceLocation(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const stored = getStoredDeviceCoordinates();
  if (!stored) return false;
  return (
    Math.abs(stored.latitude - latitude) < COORD_MATCH_TOLERANCE_DEG &&
    Math.abs(stored.longitude - longitude) < COORD_MATCH_TOLERANCE_DEG
  );
}

export async function getCurrentDeviceCoordinates({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { status: "unavailable" };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        storeDeviceCoordinates(coordinates);
        resolve({ status: "granted", coordinates });
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
