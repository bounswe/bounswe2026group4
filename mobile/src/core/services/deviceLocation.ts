import * as Location from 'expo-location';

export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
}

export type DeviceLocationResult =
  | { status: 'granted'; coordinates: DeviceCoordinates }
  | { status: 'denied' | 'unavailable' };

export async function getCurrentDeviceCoordinates(): Promise<DeviceLocationResult> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    return { status: 'denied' };
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    return { status: 'unavailable' };
  }

  const lastKnownPosition = await Location.getLastKnownPositionAsync();
  const position =
    lastKnownPosition ??
    (await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }));

  return {
    status: 'granted',
    coordinates: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    },
  };
}
