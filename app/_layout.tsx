import 'react-native-reanimated';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';

import { Colors } from '@/constants/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { detailHeaderOptions } from '@/constants/navigation';
import { refreshActiveWorkout, restoreRest } from '@/lib/session-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void refreshActiveWorkout();
    void restoreRest();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: Colors.dark.background } }}>
          <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="531" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="gslp" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="archetype/[name]" options={detailHeaderOptions} />
          <Stack.Screen name="import-strong" options={detailHeaderOptions} />
          <Stack.Screen name="workout/[id]" options={{ ...detailHeaderOptions, title: '' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
