import 'react-native-reanimated';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';

import { Colors } from '@/constants/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="workout/[slug]"
          options={{
            headerStyle: {
              backgroundColor: Colors.dark.surface,
            },
            headerTintColor: Colors.dark.text,
            headerTitleStyle: {
              color: Colors.dark.text,
            },
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="archetype/[name]"
          options={{
            headerStyle: {
              backgroundColor: Colors.dark.surface,
            },
            headerTintColor: Colors.dark.text,
            headerTitleStyle: {
              color: Colors.dark.text,
            },
            headerBackTitle: 'Back',
          }}
        />
      </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
