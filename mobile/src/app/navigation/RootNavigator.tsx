import React from 'react';
import { StatusBar, Text, View } from 'react-native';

export function RootNavigator() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Local History Story Map</Text>
        <Text style={{ marginTop: 8, color: '#4B5563', textAlign: 'center' }}>
          Mobile skeleton is ready.
        </Text>
      </View>
    </View>
  );
}
