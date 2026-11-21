// Developer page: app/update info, a one-tap "update and restart", and diagnostics.
// Not user settings (config lives in code); this is for keeping the installed build current
// and checking what's on the phone.

import * as Notifications from 'expo-notifications';
import { previewRestVoice } from '@/lib/rest-sound';
import * as Updates from 'expo-updates';

import { Alert, Share, StyleSheet, View } from 'react-native';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { dbStats, getActiveWorkout } from '@/lib/db';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { C, numStyle } from '@/constants/theme';
import Constants from 'expo-constants';
import { ThemedText } from '@/components/themed-text';
import { loadGslpState } from '@/lib/gslp-storage';
import { nextSession } from '@/lib/gslp';

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

/** The dev sections (App, Data, Tools), shown on the Settings tab and at /settings. */
export function DevSettings() {
  const router = useRouter();
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
    <View style={styles.content}>
      <ThemedText type="caption" style={styles.section}>
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

      <ThemedText type="caption" style={styles.section}>
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

      <ThemedText type="caption" style={styles.section}>
        Tools
      </ThemedText>
      <Card style={styles.card}>
        <Button title="Test rest sound" variant="secondary" onPress={() => void previewRestVoice()} />
        <Button title="Test rest notification" variant="secondary" onPress={testNotification} />
        <Button title="Share GSLP state (JSON)" variant="secondary" onPress={shareGslpState} />
        <Button title="Import Strong history" variant="secondary" onPress={() => router.push('/import-strong')} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  section: { marginTop: 16, marginLeft: 4 },
  card: { gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  label: { fontSize: 15, color: C.t2 },
  value: { ...numStyle, fontSize: 14, color: C.t1, flexShrink: 1, textAlign: 'right' },
  status: { fontSize: 13, color: C.t2, textAlign: 'center' },
});
