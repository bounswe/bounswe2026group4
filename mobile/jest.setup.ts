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
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
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
