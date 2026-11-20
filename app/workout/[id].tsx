import * as Haptics from 'expo-haptics';

import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { type GslpState, defaultGslpState } from '@/lib/gslp';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { type Workout, type WorkoutSet } from '@/lib/workout';
import {
  addExercise,
  addSet,
  formatDuration,
  formatMinutes,
  hasDoneSets,
  removeExercise,
  removeSet,
  replaceExercise,
  setsFromLast,
  finalizeWorkout,
  unfinishedSetCount,
  updateSet,
  workoutStats,
} from '@/lib/workout-edit';
import { deleteFinishedWorkout, discardWorkout, finishWorkout, lastSetsFor, reopenGslpWorkout } from '@/lib/workout-actions';
import { RestBar } from '@/components/workout/rest-bar';
import { restSecFor, getExercise } from '@/lib/exercises';
import { startRest } from '@/lib/session-store';
import { getWorkout, saveWorkout } from '@/lib/db';
import { gslpOptionalSlots, gslpProgressionFor, gslpSlotChoices, gslpSlotLabel } from '@/lib/gslp-program';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, Fonts } from '@/constants/theme';
import { ExerciseCard } from '@/components/workout/exercise-card';
import { ExerciseHistorySheet } from '@/components/workout/exercise-history-sheet';
import { ExercisePicker } from '@/components/workout/exercise-picker';
import type { ProgressionLine } from '@/lib/program-module';
import type { SetPatch } from '@/components/workout/set-row';
import { ThemedText } from '@/components/themed-text';
import { formatSet } from '@/components/workout/set-row';
import { gslpLifts } from '@/lib/gslp';
import { loadGslpState } from '@/lib/gslp-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SAVE_DELAY_MS = 400;

function persist(workout: Workout) {
  saveWorkout(workout).catch((error) => {
    console.error('Saving workout failed', error);
    Alert.alert('Save failed', error instanceof Error ? error.message : String(error));
  });
}

type PickerMode = { kind: 'add' } | { kind: 'replace'; entryId: string } | null;

const isGslp = (workout: Workout) => workout.source.kind === 'program' && workout.source.program === 'gslp';

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [missing, setMissing] = useState(false);
  const [gslp, setGslp] = useState<GslpState>(defaultGslpState);
  const [previous, setPrevious] = useState<Record<string, WorkoutSet[]>>({});
  const [summary, setSummary] = useState<ProgressionLine[] | undefined>();
  const [picker, setPicker] = useState<PickerMode>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); // editing a finished workout
  const editingRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  // ---- Load + autosave ----

  const workoutRef = useRef<Workout | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (workoutRef.current) persist(workoutRef.current);
    }
  }, []);

  const apply = useCallback((fn: (current: Workout) => Workout) => {
    const current = workoutRef.current;
    if (!current || (current.finishedAt && !editingRef.current)) return;
    const next = fn(current);
    workoutRef.current = next;
    setWorkout(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      persist(next);
    }, SAVE_DELAY_MS);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getWorkout(id), loadGslpState()]).then(([loaded, state]) => {
      if (!active) return;
      workoutRef.current = loaded;
      setWorkout(loaded);
      setMissing(!loaded);
      setGslp(state);
    });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => status !== 'active' && flush());
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  useEffect(() => {
    if (workout?.finishedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [workout?.finishedAt]);

  // "Previous" column: last finished session of each exercise before this workout started.
  const exerciseIds = workout ? [...new Set(workout.exercises.map((entry) => entry.exerciseId))] : [];
  const missingPrevious = exerciseIds.filter((exerciseId) => !(exerciseId in previous));
  const missingKey = missingPrevious.join(',');
  useEffect(() => {
    if (!workout || !missingKey) return;
    let active = true;
    Promise.all(missingKey.split(',').map(async (exerciseId) => [exerciseId, await lastSetsFor(exerciseId, workout.startedAt)] as const)).then(
      (rows) => active && setPrevious((current) => ({ ...current, ...Object.fromEntries(rows) })),
    );
    return () => {
      active = false;
    };
  }, [missingKey, workout]);

  // ---- Exercise actions ----

  const swapTo = useCallback(
    async (entryId: string, exerciseId: string) => {
      const current = workoutRef.current;
      const entry = current?.exercises.find((item) => item.id === entryId);
      if (!current || !entry) return;
      const sets = setsFromLast(await lastSetsFor(exerciseId, current.startedAt));
      const doIt = () => apply((w) => replaceExercise(w, entryId, exerciseId, sets));
      if (hasDoneSets(entry)) {
        Alert.alert('Replace exercise?', 'Sets already checked off for this exercise will be replaced.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: doIt },
        ]);
      } else {
        doIt();
      }
    },
    [apply],
  );

  const addExerciseById = useCallback(
    async (exerciseId: string, slot?: string) => {
      const current = workoutRef.current;
      if (!current) return;
      const sets = setsFromLast(await lastSetsFor(exerciseId, current.startedAt));
      apply((w) => addExercise(w, exerciseId, sets, slot));
    },
    [apply],
  );

  const openMenu = (entryId: string) => {
    const entry = workoutRef.current?.exercises.find((item) => item.id === entryId);
    if (!entry) return;
    const isMainLift = !!entry.slot && entry.slot in gslpLifts;
    const options = [
      { label: 'Exercise history', run: () => setHistoryId(entry.exerciseId) },
      ...(isMainLift ? [] : [{ label: 'Replace exercise', run: () => setPicker({ kind: 'replace', entryId }) }]),
      {
        label: 'Remove exercise',
        destructive: true,
        run: () =>
          Alert.alert(
            'Remove exercise?',
            isMainLift ? 'GSLP will count this lift as a missed session.' : undefined,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => apply((w) => removeExercise(w, entryId)) },
            ],
          ),
      },
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: getExercise(entry.exerciseId).name,
          options: [...options.map((o) => o.label), 'Cancel'],
          cancelButtonIndex: options.length,
          destructiveButtonIndex: options.findIndex((o) => o.destructive),
          userInterfaceStyle: 'dark',
        },
        (index) => options[index]?.run(),
      );
    } else {
      Alert.alert(getExercise(entry.exerciseId).name, undefined, [
        ...options.map((o) => ({ text: o.label, onPress: o.run })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  // ---- Finish / discard / undo ----

  const finish = () => {
    const current = workoutRef.current;
    if (!current) return;
    const run = async (mode: 'complete' | 'discard') => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      setBusy(true);
      try {
        const result = await finishWorkout(current, mode);
        workoutRef.current = result.workout;
        setWorkout(result.workout);
        setSummary(result.summary);
        setGslp(await loadGslpState());
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } finally {
        setBusy(false);
      }
    };
    const unfinished = unfinishedSetCount(current);
    if (unfinished > 0) {
      Alert.alert(
        'Finish workout?',
        `${unfinished} ${unfinished === 1 ? 'set has' : 'sets have'} values but ${unfinished === 1 ? "isn't" : "aren't"} checked off.`,
        [
          { text: 'Complete them', onPress: () => run('complete') },
          { text: 'Discard them', style: 'destructive', onPress: () => run('discard') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } else {
      Alert.alert('Finish workout?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', onPress: () => run('discard') },
      ]);
    }
  };

  const discard = () =>
    Alert.alert('Discard workout?', 'Nothing from this workout will be saved.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = null;
          await discardWorkout(id);
          router.back();
        },
      },
    ]);

  const reopen = () =>
    Alert.alert('Undo and reopen?', 'Restores the GSLP weights from before this workout and lets you keep editing it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reopen',
        onPress: async () => {
          const reopened = await reopenGslpWorkout(id);
          if (!reopened) {
            Alert.alert("Can't reopen", 'Only the latest GSLP workout can be reopened, and not while another is in progress.');
            return;
          }
          workoutRef.current = reopened;
          setWorkout(reopened);
          setSummary(undefined);
          setGslp(await loadGslpState());
        },
      },
    ]);

  const startEditing = () => {
    editingRef.current = true;
    setEditing(true);
  };

  const stopEditing = () => {
    const current = workoutRef.current;
    if (!current?.finishedAt) return;
    // Keep checked sets and anything with values; editing never changes when it finished.
    const cleaned = { ...finalizeWorkout(current, 'complete'), finishedAt: current.finishedAt };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    workoutRef.current = cleaned;
    setWorkout(cleaned);
    persist(cleaned);
    editingRef.current = false;
    setEditing(false);
  };

  const removeFinished = () => {
    const latestGslp = gslp.history.at(-1)?.workoutId === id;
    Alert.alert(
      'Delete workout?',
      latestGslp
        ? 'Removes it from the log and undoes its GSLP progression.'
        : 'Removes it from the log. GSLP weights are not changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteFinishedWorkout(id);
            router.back();
          },
        },
      ],
    );
  };

  // ---- Render ----

  if (!workout) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: '' }} />
        {missing ? <ThemedText style={styles.muted}>Workout not found.</ThemedText> : <ActivityIndicator color={Colors.dark.tint} />}
      </View>
    );
  }

  const finished = !!workout.finishedAt;
  const stats = workoutStats(workout, new Date(now));
  const progression = finished && isGslp(workout) ? gslpProgressionFor(gslp, workout.id) : undefined;
  const lines = summary ?? progression?.summary;
  const optionalSlots = !finished && isGslp(workout) ? gslpOptionalSlots(gslp, workout) : [];

  return (
    <>
      <Stack.Screen
        options={{
          title: finished ? (editing ? 'Edit Workout' : 'Summary') : formatDuration(stats.durationSec),
          headerRight: finished
            ? editing
              ? () => (
                  <Pressable onPress={stopEditing} hitSlop={8} style={styles.finishButton}>
                    <ThemedText style={styles.finishText}>Save</ThemedText>
                  </Pressable>
                )
              : undefined
            : () => (
                <Pressable onPress={finish} disabled={busy} hitSlop={8} style={styles.finishButton}>
                  <ThemedText style={styles.finishText}>Finish</ThemedText>
                </Pressable>
              ),
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <View style={styles.titleBlock}>
            <ThemedText type="title">{workout.name}</ThemedText>
            <ThemedText style={styles.muted}>
              {new Date(workout.startedAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </ThemedText>
            {finished && !editing ? (
              workout.notes ? <ThemedText style={styles.notesText}>{workout.notes}</ThemedText> : null
            ) : (
              <TextInput
                style={styles.notes}
                value={workout.notes ?? ''}
                onChangeText={(notes) => apply((w) => ({ ...w, notes: notes || undefined }))}
                placeholder="Notes"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardAppearance="dark"
                multiline
              />
            )}
          </View>

          {finished ? (
            <Card style={styles.summary}>
              <View style={styles.statsRow}>
                <Stat label="Time" value={formatMinutes(stats.durationSec)} />
                <Stat label="Sets" value={String(stats.sets)} />
                <Stat label="Volume" value={`${Math.round(stats.volume).toLocaleString()} lb`} />
              </View>
              {lines?.map((line) => (
                <View key={line.label} style={styles.lineRow}>
                  <View style={styles.flex}>
                    <ThemedText>{line.label}</ThemedText>
                    <ThemedText style={styles.small}>{line.note}</ThemedText>
                  </View>
                  <ThemedText style={line.tone === 'down' ? styles.down : line.tone === 'up' ? styles.up : styles.muted}>
                    {line.before} → {line.after}
                  </ThemedText>
                </View>
              ))}
              {!editing ? (
                <>
                  <Button title="Done" onPress={() => router.back()} />
                  <View style={styles.summaryActions}>
                    <Button title="Edit" variant="secondary" style={styles.flex} onPress={startEditing} />
                    {progression?.isLatest ? (
                      <Button title="Undo & reopen" variant="secondary" style={styles.flex} onPress={reopen} />
                    ) : null}
                  </View>
                  <Pressable onPress={removeFinished} style={styles.discard}>
                    <ThemedText style={styles.discardText}>Delete Workout</ThemedText>
                  </Pressable>
                </>
              ) : (
                <ThemedText style={styles.small}>
                  Editing the log only. GSLP weights don&apos;t change; use Undo &amp; reopen on the latest session for that.
                </ThemedText>
              )}
            </Card>
          ) : null}

          {finished && !editing
            ? workout.exercises.map((entry) => {
                const exercise = getExercise(entry.exerciseId);
                return (
                  <Card key={entry.id} style={styles.finishedCard}>
                    <ThemedText type="defaultSemiBold">{exercise.name}</ThemedText>
                    {entry.sets.map((set) => (
                      <ThemedText key={set.id} style={set.type === 'warmup' ? styles.muted : undefined}>
                        {set.type === 'warmup' ? 'W ' : ''}
                        {formatSet(set, exercise.tracking)}
                      </ThemedText>
                    ))}
                  </Card>
                );
              })
            : workout.exercises.map((entry) => {
                const slotLabel = isGslp(workout) ? gslpSlotLabel(entry.slot) : undefined;
                return (
                  <ExerciseCard
                    key={entry.id}
                    entry={entry}
                    previous={previous[entry.exerciseId] ?? []}
                    slotLabel={slotLabel}
                    choices={isGslp(workout) ? gslpSlotChoices(entry.slot)?.exerciseIds : undefined}
                    onSetChange={(setId, patch: SetPatch) => {
                      apply((w) => updateSet(w, entry.id, setId, patch));
                      const set = entry.sets.find((item) => item.id === setId);
                      if (!finished && patch.done && set && set.type !== 'warmup') void startRest(restSecFor(entry.exerciseId));
                    }}
                    onSetDelete={(setId) => apply((w) => removeSet(w, entry.id, setId))}
                    onAddSet={() => apply((w) => addSet(w, entry.id))}
                    onChoose={(exerciseId) => swapTo(entry.id, exerciseId)}
                    onMenu={() => openMenu(entry.id)}
                    onShowHistory={() => setHistoryId(entry.exerciseId)}
                  />
                );
              })}

          {!finished || editing ? (
            <View style={styles.footer}>
              {optionalSlots.map((slot) => (
                <Button
                  key={slot.slot}
                  title={`+ ${slot.label} (optional)`}
                  variant="secondary"
                  onPress={() => addExerciseById(slot.exerciseId, slot.slot)}
                />
              ))}
              <Button title="Add Exercise" variant="secondary" onPress={() => setPicker({ kind: 'add' })} />
              {editing ? (
                <Button title="Save Changes" onPress={stopEditing} />
              ) : (
                <Pressable onPress={discard} style={styles.discard}>
                  <ThemedText style={styles.discardText}>Discard Workout</ThemedText>
                </Pressable>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      {!finished ? <RestBar bottomInset={insets.bottom} /> : null}

      <ExercisePicker
        visible={picker !== null}
        title={picker?.kind === 'replace' ? 'Replace Exercise' : 'Add Exercise'}
        onClose={() => setPicker(null)}
        onPick={(exerciseId) => {
          const mode = picker;
          setPicker(null);
          if (mode?.kind === 'replace') void swapTo(mode.entryId, exerciseId);
          else void addExerciseById(exerciseId);
        }}
      />
      <ExerciseHistorySheet exerciseId={historyId} onClose={() => setHistoryId(null)} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="label" style={styles.muted}>
        {label}
      </ThemedText>
      <ThemedText type="defaultSemiBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark.background },
  content: { padding: 12, gap: 12 },
  titleBlock: { gap: 4, paddingHorizontal: 4, paddingBottom: 4 },
  muted: { color: Colors.dark.textMuted },
  small: { color: Colors.dark.textMuted, fontSize: 12 },
  up: { color: Colors.dark.tint },
  down: { color: Colors.dark.error },
  finishButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.dark.tint,
  },
  finishText: { color: Colors.dark.background, fontWeight: '600' },
  summary: { gap: 14 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: 4 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  finishedCard: { gap: 4 },
  summaryActions: { flexDirection: 'row', gap: 12 },
  notes: {
    marginTop: 4,
    paddingVertical: 6,
    color: Colors.dark.text,
    fontFamily: Fonts.family,
    fontSize: 14,
  },
  notesText: { marginTop: 4, fontSize: 14 },
  footer: { gap: 12, marginTop: 4 },
  discard: { alignItems: 'center', paddingVertical: 12 },
  discardText: { color: Colors.dark.error },
});
