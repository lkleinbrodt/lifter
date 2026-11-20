// Developer page: app/update info, a one-tap "update and restart", and diagnostics.
// Not user settings (config lives in code); this is for keeping the installed build current
// and checking what's on the phone.

import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';

import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import React, { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { dbStats, getActiveWorkout } from '@/lib/db';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import Constants from 'expo-constants';
import { ThemedText } from '@/components/themed-text';
import { loadGslpState } from '@/lib/gslp-storage';
import { nextSession } from '@/lib/gslp';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Diagnostics = {
  stats: Awaited<ReturnType<typeof dbStats>>;
  active: string | null;
  gslpSessions: number;
  nextGslp: string;
  notifications: string;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <ThemedText style={styles.value} numberOfLines={1} selectable>
        {value}
      </ThemedText>
    </View>
  );
}

function formatDate(date: Date | null | undefined) {
  return date ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void (async () => {
        const [stats, active, gslp, permission] = await Promise.all([
          dbStats(),
          getActiveWorkout(),
          loadGslpState(),
          Notifications.getPermissionsAsync(),
        ]);
        if (!mounted) return;
        setDiag({
          stats,
          active: active?.name ?? null,
          gslpSessions: gslp.history.length,
          nextGslp: `Workout ${nextSession(gslp).workout}`,
          notifications: permission.granted ? 'Allowed' : permission.canAskAgain ? 'Not asked' : 'Denied',
        });
      })();
      return () => {
        mounted = false;
      };
    }, []),
  );

  const checkForUpdate = async () => {
    if (!Updates.isEnabled) {
      setUpdateStatus('Updates are off in development builds.');
      return;
    }
    setChecking(true);
    setUpdateStatus('Checking…');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setUpdateStatus('Up to date.');
        return;
      }
      setUpdateStatus('Downloading…');
      await Updates.fetchUpdateAsync();
      setUpdateStatus('Restarting…');
      await Updates.reloadAsync();
    } catch (error) {
      setUpdateStatus(`Failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setChecking(false);
    }
  };

  const testNotification = async () => {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Notifications are off', 'Turn them on for Lifter in iOS Settings.');
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Test', body: 'Rest notifications work.', sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
    });
    Alert.alert('Scheduled', 'Lock the phone; it should ding in 5 seconds.');
  };

  const shareGslpState = async () => {
    const state = await loadGslpState();
    await Share.share({ message: JSON.stringify(state, null, 2) });
  };

  const updateId = Updates.updateId;

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <ThemedText type="label" style={styles.section}>
          App
        </ThemedText>
        <Card style={styles.card}>
          <Row label="Version" value={Constants.expoConfig?.version ?? '—'} />
          <Row label="Runtime" value={Updates.runtimeVersion || '—'} />
          <Row label="Channel" value={Updates.channel || '—'} />
          <Row label="Running" value={!Updates.isEnabled ? 'Dev server' : Updates.isEmbeddedLaunch ? 'Embedded bundle' : 'OTA update'} />
          <Row label="Update" value={updateId ? updateId.slice(0, 8) : '—'} />
          <Row label="Published" value={formatDate(Updates.createdAt)} />
          <Button title="Check for update" loading={checking} onPress={checkForUpdate} />
          {updateStatus ? <ThemedText style={styles.status}>{updateStatus}</ThemedText> : null}
          <Button title="Restart app" variant="secondary" onPress={() => void Updates.reloadAsync()} />
        </Card>

        <ThemedText type="label" style={styles.section}>
          Data
        </ThemedText>
        <Card style={styles.card}>
          <Row label="Workouts logged" value={diag ? String(diag.stats.workouts) : '…'} />
          <Row label="From Strong" value={diag ? String(diag.stats.imported) : '…'} />
          <Row label="Sets" value={diag ? diag.stats.sets.toLocaleString() : '…'} />
          <Row label="In progress" value={diag ? (diag.active ?? 'None') : '…'} />
          <Row label="GSLP sessions" value={diag ? String(diag.gslpSessions) : '…'} />
          <Row label="GSLP next" value={diag?.nextGslp ?? '…'} />
          <Row label="DB schema" value={diag ? `v${diag.stats.schemaVersion}` : '…'} />
          <Row label="Notifications" value={diag?.notifications ?? '…'} />
        </Card>

        <ThemedText type="label" style={styles.section}>
          Tools
        </ThemedText>
        <Card style={styles.card}>
          <Button title="Test rest notification" variant="secondary" onPress={testNotification} />
          <Button title="Share GSLP state (JSON)" variant="secondary" onPress={shareGslpState} />
          <Button title="Import Strong history" variant="secondary" onPress={() => router.push('/import-strong')} />
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  section: { color: Colors.dark.textMuted, marginTop: 12, marginLeft: 4 },
  card: { gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  label: { color: Colors.dark.textMuted },
  value: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  status: { color: Colors.dark.textMuted, fontSize: 13, textAlign: 'center' },
});
