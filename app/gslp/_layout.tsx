import { Stack } from 'expo-router';
import { detailHeaderOptions } from '@/constants/navigation';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function GslpLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="session" options={detailHeaderOptions} />
    </Stack>
  );
}
