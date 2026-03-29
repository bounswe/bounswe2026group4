import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

export function RootNavigator() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>Local History Story Map</Text>
        <Text style={{ marginTop: 8 }}>Mobile skeleton is ready.</Text>
      </View>
    </SafeAreaView>
  );
}
