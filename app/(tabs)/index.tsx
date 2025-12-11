import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { LiftKey, Maxes, defaultMaxes, loadMaxes, saveMaxes } from '@/lib/storage';
import React, { useCallback, useEffect, useState } from 'react';
import { getLiftLabel, getTrainingMaxForLift } from '@/lib/workout-plan';

import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const liftOrder: LiftKey[] = ['squat', 'bench', 'deadlift'];

export default function MaxesScreen() {
  const insets = useSafeAreaInsets();
  const [maxes, setMaxes] = useState<Maxes>(defaultMaxes);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      const stored = await loadMaxes();
      setMaxes(stored);
      setLoading(false);
    };
    load();
  }, []);

  const persist = useCallback(async (next: Maxes) => {
    setStatus('Saving…');
    await saveMaxes(next);
    setStatus('Saved');
    setTimeout(() => setStatus(''), 1500);
  }, []);

  const handleChange = useCallback((key: LiftKey, text: string) => {
    const numeric = Number(text.replace(/[^0-9]/g, ''));
    setMaxes((prev) => ({ ...prev, [key]: Number.isFinite(numeric) ? numeric : 0 }));
  }, []);

  const handleBlur = useCallback(
    (key: LiftKey) => {
      const next = { ...maxes };
      if (!Number.isFinite(next[key])) {
        next[key] = 0;
      }
      void persist(next);
    },
    [maxes, persist],
  );

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Loading maxes…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <SafeAreaContainer edges={['top', 'left', 'right']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ThemedView style={styles.container}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
              <ThemedText type="display">
                One Rep Maxes
              </ThemedText>
              <ThemedText style={styles.subtle}>Training Max = 90% of your 1RM.</ThemedText>

              {liftOrder.map((lift) => {
                const tm = Math.round(getTrainingMaxForLift(maxes, lift));
                return (
                  <Card key={lift} style={styles.card}>
                    <Input
                      label={getLiftLabel(lift)}
                      suffix="lbs"
                      value={maxes[lift] ? String(maxes[lift]) : ''}
                      onChangeText={(text) => handleChange(lift, text)}
                      onBlur={() => handleBlur(lift)}
                      keyboardType="number-pad"
                      inputMode="numeric"
                    />
                    <ThemedText style={styles.trainingMax}>Training Max: {tm} lbs</ThemedText>
                  </Card>
                );
              })}

              {status ? <ThemedText style={styles.status}>{status}</ThemedText> : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </ThemedView>
      </TouchableWithoutFeedback>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  scrollContent: {
    paddingBottom: 32,
    gap: 16,
  },
  subtle: {
    color: Colors.dark.textMuted,
  },
  helper: {
    color: Colors.dark.textMuted,
  },
  trainingMax: {
    color: Colors.dark.tint,
    marginTop: 8,
    fontSize: 14,
  },
  status: {
    textAlign: 'center',
    color: Colors.dark.textMuted,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
