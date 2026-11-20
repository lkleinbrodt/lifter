import * as DocumentPicker from 'expo-document-picker';

import { type GslpState, defaultGslpState, formatLiftWeight, gslpLifts, nextSession } from '@/lib/gslp';
import { ScrollView, StyleSheet, View } from 'react-native';
import { type StrongImport, parseStrongCsv } from '@/lib/strong-import';
import React, { useEffect, useMemo, useState } from 'react';
import { countWorkouts, saveWorkouts } from '@/lib/db';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { File } from 'expo-file-system';
import { Stack } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { impliedGslpWeights } from '@/lib/gslp-program';
import { loadGslpState } from '@/lib/gslp-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// One-off: load the Strong CSV export into the workout log and compare what it implies
// for GSLP against Lifter's stored weights. Safe to re-run; workouts are keyed by start time.
export default function ImportStrongScreen() {
  const insets = useSafeAreaInsets();
  const [stored, setStored] = useState<number | null>(null);
  const [gslp, setGslp] = useState<GslpState>(defaultGslpState);
  const [parsed, setParsed] = useState<StrongImport | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    countWorkouts().then(setStored);
    loadGslpState().then(setGslp);
  }, []);

  const implied = useMemo(() => (parsed ? impliedGslpWeights(parsed.workouts) : null), [parsed]);

  const pick = async () => {
    setStatus('');
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    try {
      const text = await new File(result.assets[0].uri).text();
      setParsed(parseStrongCsv(text));
    } catch (error) {
      setParsed(null);
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const runImport = async () => {
    if (!parsed) return;
    setStatus('Importing…');
    await saveWorkouts(parsed.workouts);
    setStored(await countWorkouts());
    setStatus(`Imported ${parsed.workouts.length} workouts.`);
  };

  const lifterNext = nextSession(gslp).workout;

  return (
    <>
      <Stack.Screen options={{ title: 'Import Strong' }} />
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <ThemedText style={styles.muted}>Workouts in the log: {stored ?? '…'}</ThemedText>
          <Button title={parsed ? 'Choose a different CSV' : 'Choose Strong CSV'} variant="secondary" onPress={pick} />

          {parsed ? (
            <Card style={styles.card}>
              <ThemedText type="defaultSemiBold">
                {parsed.workouts.length} workouts · {parsed.setCount} sets
              </ThemedText>
              {parsed.workouts.length > 0 ? (
                <ThemedText style={styles.muted}>
                  {formatDate(parsed.workouts[0].startedAt)} – {formatDate(parsed.workouts.at(-1)!.startedAt)}
                </ThemedText>
              ) : null}
              {parsed.unmappedExercises.length > 0 ? (
                <>
                  <ThemedText style={styles.warn}>
                    Not in the exercise catalog (add their Strong names to lib/exercises.ts):
                  </ThemedText>
                  {parsed.unmappedExercises.map((name) => (
                    <ThemedText key={name} style={styles.warn}>
                      • {name}
                    </ThemedText>
                  ))}
                </>
              ) : (
                <Button title={`Import ${parsed.workouts.length} workouts`} onPress={runImport} />
              )}
            </Card>
          ) : null}

          {implied ? (
            <Card style={styles.card}>
              <ThemedText type="defaultSemiBold">GSLP check</ThemedText>
              <ThemedText style={styles.muted}>Next weight from Strong&apos;s latest session vs. Lifter now.</ThemedText>
              {implied.lifts.map((row) => {
                const lift = gslpLifts[row.lift];
                const ok = gslp.weights[row.lift] === row.nextWeight;
                return (
                  <View key={row.lift} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <ThemedText>{lift.label}</ThemedText>
                      <ThemedText style={styles.small}>
                        {formatDate(row.date)}: {row.weight} × {row.reps}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.value}>{formatLiftWeight(lift, row.nextWeight)}</ThemedText>
                    <ThemedText style={[styles.value, ok ? styles.ok : styles.warn]}>
                      {formatLiftWeight(lift, gslp.weights[row.lift])}
                    </ThemedText>
                  </View>
                );
              })}
              <ThemedText style={implied.nextTemplate === lifterNext ? styles.ok : styles.warn}>
                Next workout: Strong says {implied.nextTemplate ?? '?'}, Lifter says {lifterNext}
              </ThemedText>
            </Card>
          ) : null}

          {status ? <ThemedText style={styles.muted}>{status}</ThemedText> : null}
        </ScrollView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { width: 90, textAlign: 'right', fontVariant: ['tabular-nums'] },
  muted: { color: Colors.dark.textMuted },
  small: { color: Colors.dark.textMuted, fontSize: 12 },
  ok: { color: Colors.dark.tint },
  warn: { color: Colors.dark.error },
});
