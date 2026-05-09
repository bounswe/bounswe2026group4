import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import {
  getCurrentDeviceCoordinates,
  getStoredDeviceCoordinates,
  isProximityFromDeviceLocation,
} from "../deviceLocationService";

const originalNavigator = globalThis.navigator;

beforeEach(() => {
  // Each test starts from a clean session — a stale entry from a prior test
  // would let isProximityFromDeviceLocation succeed accidentally.
  if (typeof sessionStorage !== "undefined") sessionStorage.clear();
});

afterEach(() => {
  globalThis.navigator = originalNavigator;
  vi.restoreAllMocks();
});

function stubGeolocation(impl) {
  globalThis.navigator = { geolocation: { getCurrentPosition: impl } };
}

describe("getCurrentDeviceCoordinates", () => {
  it("returns coordinates with status 'granted' on success", async () => {
    stubGeolocation((onSuccess) => {
      onSuccess({ coords: { latitude: 41.0082, longitude: 28.9784 } });
    });

    const result = await getCurrentDeviceCoordinates();

    expect(result).toEqual({
      status: "granted",
      coordinates: { latitude: 41.0082, longitude: 28.9784 },
    });
  });

  it("returns 'denied' when the browser surfaces PERMISSION_DENIED (code 1)", async () => {
    stubGeolocation((_, onError) => {
      onError({ code: 1, message: "User denied geolocation" });
    });

    const result = await getCurrentDeviceCoordinates();

    expect(result).toEqual({ status: "denied" });
  });

  it("returns 'unavailable' for non-permission errors (timeout, position unavailable)", async () => {
    stubGeolocation((_, onError) => {
      onError({ code: 3, message: "Timeout" });
    });

    const result = await getCurrentDeviceCoordinates();

    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns 'unavailable' when navigator.geolocation is missing", async () => {
    globalThis.navigator = {};

    const result = await getCurrentDeviceCoordinates();

    expect(result).toEqual({ status: "unavailable" });
  });

  it("forwards a custom timeout to getCurrentPosition options", async () => {
    const impl = vi.fn((onSuccess) => {
      onSuccess({ coords: { latitude: 0, longitude: 0 } });
    });
    stubGeolocation(impl);

    await getCurrentDeviceCoordinates({ timeoutMs: 1234 });

    expect(impl).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ timeout: 1234 })
    );
  });

  it("persists granted coordinates to sessionStorage so downstream UI can recognise them later", async () => {
    stubGeolocation((onSuccess) => {
      onSuccess({ coords: { latitude: 41.0082, longitude: 28.9784 } });
    });

    await getCurrentDeviceCoordinates();

    expect(getStoredDeviceCoordinates()).toEqual({
      latitude: 41.0082,
      longitude: 28.9784,
    });
  });

  it("does not persist anything when the browser denies the request", async () => {
    stubGeolocation((_, onError) => onError({ code: 1 }));

    await getCurrentDeviceCoordinates();

    expect(getStoredDeviceCoordinates()).toBeNull();
  });
});

describe("isProximityFromDeviceLocation", () => {
  it("returns false before any device-location grant has happened this session", () => {
    expect(isProximityFromDeviceLocation(41.0, 28.9)).toBe(false);
  });

  it("returns true for coords that match the granted device location exactly", async () => {
    stubGeolocation((onSuccess) => {
      onSuccess({ coords: { latitude: 41.0082, longitude: 28.9784 } });
    });
    await getCurrentDeviceCoordinates();

    expect(isProximityFromDeviceLocation(41.0082, 28.9784)).toBe(true);
  });

  it("tolerates the 4-decimal display rounding (~11 m drift)", async () => {
    stubGeolocation((onSuccess) => {
      onSuccess({ coords: { latitude: 41.00821234, longitude: 28.97843456 } });
    });
    await getCurrentDeviceCoordinates();

    // 4-decimal rounding is what the URL ends up carrying.
    expect(isProximityFromDeviceLocation(41.0082, 28.9784)).toBe(true);
  });

  it("returns false for coords that differ beyond the tolerance", async () => {
    stubGeolocation((onSuccess) => {
      onSuccess({ coords: { latitude: 41.0082, longitude: 28.9784 } });
    });
    await getCurrentDeviceCoordinates();

    // ~1 km away — this is plainly a different point.
    expect(isProximityFromDeviceLocation(41.02, 28.99)).toBe(false);
  });

  it("returns false when latitude or longitude is non-finite", async () => {
    stubGeolocation((onSuccess) => {
      onSuccess({ coords: { latitude: 41.0082, longitude: 28.9784 } });
    });
    await getCurrentDeviceCoordinates();

    expect(isProximityFromDeviceLocation(null, 28.9784)).toBe(false);
    expect(isProximityFromDeviceLocation(41.0082, undefined)).toBe(false);
    expect(isProximityFromDeviceLocation(NaN, NaN)).toBe(false);
  });
});
