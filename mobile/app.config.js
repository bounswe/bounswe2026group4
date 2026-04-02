const appJson = require('./app.json');
const googleMapsApiKey = process.env.EXPO_PUBLIC_MAP_API_KEY;

module.exports = () => {
  const expoConfig = appJson.expo ?? {};
  const androidConfig = expoConfig.android ?? {};
  const nestedAndroidConfig = androidConfig.config ?? {};

  return {
    ...expoConfig,
    android: {
      ...androidConfig,
      config: {
        ...nestedAndroidConfig,
        ...(googleMapsApiKey
          ? {
              googleMaps: {
                apiKey: googleMapsApiKey,
              },
            }
          : {}),
      },
    },
  };
};
