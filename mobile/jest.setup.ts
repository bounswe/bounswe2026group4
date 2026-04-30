jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMap = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, props, children);
  const MockMarker = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, props, children);

  return {
    __esModule: true,
    default: MockMap,
    Marker: MockMarker,
  };
});

jest.mock('expo-image-picker', () => ({
  __esModule: true,
  MediaTypeOptions: {
    Images: 'images',
  },
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

jest.mock('expo-location', () => ({
  __esModule: true,
  Accuracy: {
    Balanced: 3,
  },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  hasServicesEnabledAsync: jest.fn(async () => true),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: {
      latitude: 41.0082,
      longitude: 28.9784,
    },
  })),
  getLastKnownPositionAsync: jest.fn(async () => null),
}));

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  const MockWebView = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(View, props, children);

  return {
    __esModule: true,
    WebView: MockWebView,
    default: MockWebView,
  };
}, { virtual: true });
