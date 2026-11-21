// /settings: the dev sections on their own page (5/3/1's gear and deep links). On GSLP they're
// at the bottom of the Settings tab.

import { ScrollView, StyleSheet } from 'react-native';

import { DevSettings } from '@/components/dev-settings';
import React from 'react';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <DevSettings />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
});
