import * as Haptics from 'expo-haptics';

import {
  type GslpLift,
  type GslpLiftKey,
  type GslpState,
  type PullVariant,
  defaultGslpState,
  describeOutcome,
  formatNumber,
  formatScheme,
  gslpLifts,
  gslpWorkouts,
  jumpFor,
  liftsForWorkout,
} from '@/lib/gslp';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import React, { useCallback, useState } from 'react';
import { loadGslpState, saveGslpState } from '@/lib/gslp-storage';

import { Card } from '@/components/ui/Card';
import { Collapsible } from '@/components/ui/collapsible';
import { Colors } from '@/constants/theme';
import { Input } from '@/components/ui/Input';
import { ProgramHeader } from '@/components/program-header';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_WEIGHT = 1500;
const pullOptions: PullVariant[] = ['latPulldown', 'chinup'];

export default function GslpWeightsScreen() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<GslpState>(defaultGslpState);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  // Raw text while editing, so partial decimals like "132." survive re-renders.
  const [editing, setEditing] = useState<Partial<Record<GslpLiftKey, string>>>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadGslpState().then((stored) => {
        if (active) {
          setState(stored);
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const persist = useCallback(async (next: GslpState) => {
    setState(next);
    setStatus('Saving…');
    await saveGslpState(next);
    setStatus('Saved');
    setTimeout(() => setStatus(''), 1500);
  }, []);

  const handleChange = useCallback((key: GslpLiftKey, text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setEditing((prev) => ({ ...prev, [key]: cleaned }));
  }, []);

  const handleBlur = useCallback(
    (key: GslpLiftKey) => {
      const text = editing[key];
      if (text === undefined) return;
      const parsed = Number(text);
      const weight = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), MAX_WEIGHT) : 0;
      setEditing((prev) => ({ ...prev, [key]: undefined }));
      if (weight !== state.weights[key]) {
        void persist({ ...state, weights: { ...state.weights, [key]: weight } });
      }
    },
    [editing, persist, state],
  );

  const handlePullVariant = useCallback(
    (variant: PullVariant) => {
      if (variant === state.pullVariant) return;
      void Haptics.selectionAsync();
      void persist({ ...state, pullVariant: variant });
    },
    [persist, state],
  );

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Loading weights…</ThemedText>
      </ThemedView>
    );
  }

  const renderLift = (lift: GslpLift) => {
    const isPull = lift.key === 'chinup' || lift.key === 'latPulldown';
    const weight = state.weights[lift.key];
    const lastLog = [...state.history]
      .reverse()
      .flatMap((session) => session.lifts)
      .find((log) => log.lift === lift.key);
    const hints = [
      lift.equipment === 'bodyweight' ? 'Added load, 0 = bodyweight' : null,
      `+${formatNumber(jumpFor(lift))} per session`,
      lift.minWeight > 45 ? `min ${lift.minWeight}` : null,
    ].filter(Boolean);

    return (
      <Card key={isPull ? 'pull' : lift.key} style={styles.card}>
        {isPull ? (
          <View style={styles.segmented}>
            {pullOptions.map((option) => {
              const selected = option === state.pullVariant;
              return (
                <Pressable
                  key={option}
                  onPress={() => handlePullVariant(option)}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {gslpLifts[option].label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Input
          label={`${lift.label} · ${formatScheme(lift)}`}
          suffix="lbs"
          value={editing[lift.key] ?? (weight ? formatNumber(weight) : '')}
          placeholder={lift.equipment === 'bodyweight' ? '0' : undefined}
          onChangeText={(text) => handleChange(lift.key, text)}
          onBlur={() => handleBlur(lift.key)}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        <ThemedText style={styles.hint}>{hints.join(' · ')}</ThemedText>
        {lastLog ? (
          <ThemedText style={styles.hint}>
            Last: {formatNumber(lastLog.weight)} × {lastLog.amrapReps ?? '—'} →{' '}
            {describeOutcome(lastLog.outcome, lastLog.weight, lastLog.nextWeight)}
          </ThemedText>
        ) : null}
      </Card>
    );
  };

  return (
    <SafeAreaContainer edges={['top', 'left', 'right']}>
        <ThemedView style={styles.container}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag">
              <ProgramHeader title="Weights" />
              <ThemedText style={styles.subtle}>
                Current work-set weight for each lift. Finishing a session updates these automatically.
              </ThemedText>

              <Card style={styles.card}>
                <Collapsible title="Picking starting weights">
                  <View style={styles.guide}>
                    <ThemedText style={styles.subtle}>
                      Work up in sets of 5 from the empty bar, adding 10–20 lb, until form or bar speed slips. Use
                      that weight.
                    </ThemedText>
                    <ThemedText style={styles.subtle}>
                      Start deliberately light. You&apos;ll reach hard weights in 2–3 weeks anyway.
                    </ThemedText>
                    <ThemedText style={styles.subtle}>
                      Chin-ups start at bodyweight with no added load. Deadlift starts at 95 lb minimum for bar
                      height.
                    </ThemedText>
                  </View>
                </Collapsible>
              </Card>

              {(['A', 'B'] as const).map((key) => (
                <View key={key} style={styles.section}>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>
                    {gslpWorkouts[key].label} · {gslpWorkouts[key].focus}
                  </ThemedText>
                  {liftsForWorkout(key, state.pullVariant).map(renderLift)}
                </View>
              ))}

              {status ? <ThemedText style={styles.status}>{status}</ThemedText> : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </ThemedView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    gap: 16,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    opacity: 0.8,
  },
  card: {
    gap: 10,
  },
  guide: {
    gap: 8,
  },
  subtle: {
    color: Colors.dark.textMuted,
  },
  hint: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginLeft: 4,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  segmentSelected: {
    backgroundColor: Colors.dark.surfaceHighlight,
  },
  segmentText: {
    fontSize: 14,
    color: Colors.dark.textMuted,
  },
  segmentTextSelected: {
    color: Colors.dark.tint,
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
