import 'react-native-reanimated';

import { DarkTheme, ThemeProvider, type Theme } from '@react-navigation/native';

import { Appearance } from 'react-native';
import { C, Colors } from '@/constants/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { detailHeaderOptions } from '@/constants/navigation';
import { refreshActiveWorkout, restoreRest } from '@/lib/session-store';
import { startLiveActivity } from '@/lib/live-activity';
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: 'index',
};

// Dark-only app: force dark so system alerts and action sheets match. JS-only, no rebuild.
Appearance.setColorScheme('dark');

const navTheme: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: C.accent, background: C.bg, card: C.bg, text: C.t1, border: C.line },
};

export default function RootLayout() {
  useEffect(() => {
    void Promise.all([refreshActiveWorkout(), restoreRest()]).finally(startLiveActivity);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      <ThemeProvider value={navTheme}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: Colors.dark.background } }}>
          <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="531" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="gslp" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="archetype/[name]" options={detailHeaderOptions} />
          <Stack.Screen name="import-strong" options={detailHeaderOptions} />
          <Stack.Screen name="settings" options={detailHeaderOptions} />
          <Stack.Screen name="workout/[id]" options={{ ...detailHeaderOptions, title: '' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
