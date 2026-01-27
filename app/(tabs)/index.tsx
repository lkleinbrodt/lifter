import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { LiftKey, Maxes, defaultMaxes, loadMaxes, saveMaxes } from '@/lib/storage';
import React, { useCallback, useEffect, useState } from 'react';
import { getLiftLabel, trainingMax } from '@/lib/workout-plan';

import { Button } from '@/components/ui/Button';
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
  const [oneRepMaxes, setOneRepMaxes] = useState<Maxes>(defaultMaxes);
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

  const handleOneRepChange = useCallback((key: LiftKey, text: string) => {
    const numeric = Number(text.replace(/[^0-9]/g, ''));
    setOneRepMaxes((prev) => ({ ...prev, [key]: Number.isFinite(numeric) ? numeric : 0 }));
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

  const handleApplyOneRepMax = useCallback(
    async (key: LiftKey) => {
      const next = { ...maxes };
      next[key] = Math.round(trainingMax(oneRepMaxes[key] ?? 0));
      setMaxes(next);
      await persist(next);
    },
    [maxes, oneRepMaxes, persist],
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
              <ThemedText type="display">Training Maxes</ThemedText>
              <ThemedText style={styles.subtle}>
                Update your training max directly, or calculate it from a 1RM.
              </ThemedText>

              {liftOrder.map((lift) => {
                return (
                  <Card key={lift} style={styles.card}>
                    <Input
                      label={`${getLiftLabel(lift)} Training Max`}
                      suffix="lbs"
                      value={maxes[lift] ? String(maxes[lift]) : ''}
                      onChangeText={(text) => handleChange(lift, text)}
                      onBlur={() => handleBlur(lift)}
                      keyboardType="number-pad"
                      inputMode="numeric"
                    />
                    <View style={styles.calcRow}>
                      <Input
                        label="Calculate from 1RM"
                        suffix="lbs"
                        value={oneRepMaxes[lift] ? String(oneRepMaxes[lift]) : ''}
                        onChangeText={(text) => handleOneRepChange(lift, text)}
                        keyboardType="number-pad"
                        inputMode="numeric"
                      />
                      <Button
                        title="Use 1RM"
                        onPress={() => handleApplyOneRepMax(lift)}
                        variant="secondary"
                        style={styles.calcButton}
                      />
                    </View>
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
  calcRow: {
    gap: 12,
  },
  calcButton: {
    alignSelf: 'flex-start',
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
