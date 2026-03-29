export const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  mapApiKey: process.env.EXPO_PUBLIC_MAP_API_KEY ?? '',
  environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
};
