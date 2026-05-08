import { describe, it, expect, vi, afterEach } from "vitest";

import { getCurrentDeviceCoordinates } from "../deviceLocationService";

const originalNavigator = globalThis.navigator;

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
});
