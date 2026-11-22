// Bottom sheet to move a finished workout's end time, for when Finish was tapped late.
// Steps in minutes, plus a shortcut to the last set's time. Never earlier than the last set.

import { Modal, Pressable, StyleSheet, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { earliestFinish, formatMinutes, lastSetAt, setFinishedAt } from '@/lib/workout-edit';

import { Button } from '@/components/ui/Button';
import { C, Radius, numStyle } from '@/constants/theme';
import { Chip } from '@/components/ui/primitives';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import type { Workout } from '@/lib/workout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STEPS = [-15, -5, 5, 15];

export const clockTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function FinishTimeSheet({
  workout,
  visible,
  onClose,
  onSave,
}: {
  workout: Workout;
  visible: boolean;
  onClose: () => void;
  onSave: (workout: Workout) => void;
}) {
  const insets = useSafeAreaInsets();
  const original = workout.finishedAt ? new Date(workout.finishedAt) : new Date();
  const [end, setEnd] = useState(original);
  useEffect(() => {
    if (visible && workout.finishedAt) setEnd(new Date(workout.finishedAt));
  }, [visible, workout.finishedAt]);

  const earliest = earliestFinish(workout);
  const lastSet = lastSetAt(workout);
  const latest = Math.max(Date.now(), original.getTime());
  const move = (minutes: number) =>
    setEnd((current) => new Date(Math.min(latest, Math.max(earliest.getTime(), current.getTime() + minutes * 60_000))));
  const durationSec = Math.max(0, (end.getTime() - new Date(workout.startedAt).getTime()) / 1000);
  const changed = end.getTime() !== original.getTime();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Finished at</ThemedText>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
            <IconSymbol name="xmark" size={15} color={C.t2} />
          </Pressable>
        </View>

        <View style={styles.readout}>
          <ThemedText num style={styles.time}>
            {clockTime(end)}
          </ThemedText>
          <ThemedText num style={styles.duration}>
            {formatMinutes(durationSec)} · started {clockTime(new Date(workout.startedAt))}
          </ThemedText>
        </View>

        <View style={styles.steps}>
          {STEPS.map((step) => {
            const disabled = step < 0 ? end.getTime() <= earliest.getTime() : end.getTime() >= latest;
            return (
              <Pressable
                key={step}
                onPress={() => move(step)}
                disabled={disabled}
                style={({ pressed }) => [styles.step, pressed && styles.pressed, disabled && styles.disabled]}
                accessibilityLabel={`${step > 0 ? 'Later' : 'Earlier'} by ${Math.abs(step)} minutes`}>
                <ThemedText num style={styles.stepText}>
                  {step > 0 ? `+${step}` : `−${-step}`}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.chips}>
          {lastSet ? (
            <Chip label={`Last set ${clockTime(lastSet)}`} selected={end.getTime() === lastSet.getTime()} onPress={() => setEnd(lastSet)} />
          ) : null}
          {changed ? <Chip label={`Was ${clockTime(original)}`} onPress={() => setEnd(original)} /> : null}
        </View>

        <Button title="Save" disabled={!changed} onPress={() => onSave(setFinishedAt(workout, end))} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: C.s1, borderTopLeftRadius: Radius.hero, borderTopRightRadius: Radius.hero, paddingHorizontal: 16, paddingTop: 18, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  close: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center' },
  readout: { alignItems: 'center', gap: 4 },
  time: { ...numStyle, fontSize: 40, lineHeight: 48, fontWeight: '700' },
  duration: { ...numStyle, fontSize: 14, color: C.t2 },
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, height: 48, borderRadius: Radius.button, backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center' },
  stepText: { ...numStyle, fontSize: 17, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
  chips: { flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 36 },
});
