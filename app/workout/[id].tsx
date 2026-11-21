import * as Haptics from 'expo-haptics';

import {
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
  currentSet,
  exerciseBlocks,
  supersetTag,
  formatDuration,
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
import { restSecFor, getExercise, splitExerciseName } from '@/lib/exercises';
import { setActiveWorkout, startRest, summarizeActive } from '@/lib/session-store';
import { getWorkout, saveWorkout } from '@/lib/db';
import { gslpOptionalSlots, gslpSlotChoices, gslpSlotLabel } from '@/lib/gslp-program';

import { Button } from '@/components/ui/Button';
import { C, Colors, Fonts, numStyle } from '@/constants/theme';
import { ExerciseCard, cardLayout } from '@/components/workout/exercise-card';
import Animated from 'react-native-reanimated';
import { SupersetGroup } from '@/components/workout/superset-group';
import { nextUpFor } from '@/components/workout/next-up';
import { WorkoutSummary } from '@/components/workout/workout-summary';
import { ExerciseHistorySheet } from '@/components/workout/exercise-history-sheet';
import { ExercisePicker } from '@/components/workout/exercise-picker';
import type { SetPatch } from '@/components/workout/set-row';
import { ThemedText } from '@/components/themed-text';
import { gslpLifts, sessionPosition } from '@/lib/gslp';
import { workoutDisplayName } from '@/lib/workout-names';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ActionMenu, type MenuAnchor, type MenuState, measureAnchor } from '@/components/ui/action-menu';
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
  const [picker, setPicker] = useState<PickerMode>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); // editing a finished workout
  const editingRef = useRef(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const notesRef = useRef<TextInput>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const headerMenuRef = useRef<View>(null);
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
    if (!next.finishedAt) setActiveWorkout(summarizeActive(next)); // keeps the minibar's set count live
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

  const openMenu = (entryId: string, anchor: MenuAnchor) => {
    const entry = workoutRef.current?.exercises.find((item) => item.id === entryId);
    if (!entry) return;
    const isMainLift = !!entry.slot && entry.slot in gslpLifts;
    setMenu({
      anchor,
      title: splitExerciseName(getExercise(entry.exerciseId).name).title,
      items: [
        { label: 'History', icon: 'clock.arrow.circlepath', onPress: () => setHistoryId(entry.exerciseId) },
        ...(isMainLift
          ? []
          : [{ label: 'Replace', icon: 'arrow.left.arrow.right' as const, onPress: () => setPicker({ kind: 'replace', entryId }) }]),
        {
          label: 'Remove',
          icon: 'trash',
          destructive: true,
          onPress: () =>
            Alert.alert('Remove exercise?', isMainLift ? 'GSLP will count this lift as a missed session.' : undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => apply((w) => removeExercise(w, entryId)) },
            ]),
        },
      ],
    });
  };

  const openWorkoutMenu = (anchor: MenuAnchor) => {
    const hasNotes = !!workoutRef.current?.notes;
    setMenu({
      anchor,
      items: [
        {
          label: hasNotes ? 'Edit note' : 'Add note',
          icon: 'note.text',
          onPress: () => {
            setNotesOpen(true);
            setTimeout(() => notesRef.current?.focus(), 50);
          },
        },
      ],
    });
  };

  const openSummaryMenu = (anchor: MenuAnchor) => {
    const latest = !!workoutRef.current && gslp.history.at(-1)?.workoutId === workoutRef.current.id;
    setMenu({
      anchor,
      items: [
        { label: 'Edit', icon: 'pencil', onPress: startEditing },
        ...(latest ? [{ label: 'Undo & reopen', icon: 'arrow.uturn.backward' as const, onPress: reopen }] : []),
        { label: 'Delete', icon: 'trash', destructive: true, onPress: removeFinished },
      ],
    });
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
  const optionalSlots = !finished && isGslp(workout) ? gslpOptionalSlots(gslp, workout) : [];
  const current = finished ? undefined : currentSet(workout);
  const blocks = exerciseBlocks(workout.exercises);
  const nextUp = finished ? undefined : nextUpFor(workout);
  const totalSets = workout.exercises.reduce((sum, entry) => sum + entry.sets.length, 0);
  const doneSets = workout.exercises.reduce((sum, entry) => sum + entry.sets.filter((set) => set.done).length, 0);
  const eyebrow =
    workout.source.kind === 'program'
      ? (() => {
          const { week, day } = sessionPosition(workout.source.sessionIndex);
          return `${workout.source.program.toUpperCase()} · Week ${week} · Day ${day}`;
        })()
      : workout.source.kind === 'import'
        ? 'From Strong'
        : finished
          ? 'Workout' // the nav already shows the date
          : new Date(workout.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  // Replacing an accessory: its slot's pool comes first (and the current pick is checked).
  const replacing = picker?.kind === 'replace' ? workout.exercises.find((entry) => entry.id === picker.entryId) : undefined;
  const slotChoices = replacing && isGslp(workout) ? gslpSlotChoices(replacing.slot) : undefined;
  const pickerSlot = replacing
    ? {
        currentId: replacing.exerciseId,
        slotIds: slotChoices?.exerciseIds,
        subtitle: [splitExerciseName(getExercise(replacing.exerciseId).name).title, slotChoices ? `${slotChoices.label.toLowerCase()} slot` : undefined]
          .filter(Boolean)
          .join(' · '),
      }
    : {};
  const showNotesField = (!finished || editing) && (notesOpen || !!workout.notes);

  return (
    <>
      <Stack.Screen
        options={{
          title: finished
            ? new Date(workout.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
            : formatDuration(stats.durationSec),
          // Plain text, no background: iOS 26 already draws a glass capsule around header items,
          // and a filled pill inside it shows as a double ring.
          headerTitleStyle: finished ? undefined : { fontFamily: Fonts.num },
          headerRight:
            finished && !editing
              ? () => (
                  <View style={styles.headerActions}>
                    <View ref={headerMenuRef} collapsable={false}>
                      <Pressable
                        onPress={() => measureAnchor(headerMenuRef.current, openSummaryMenu)}
                        hitSlop={8}
                        style={styles.headerButton}
                        accessibilityLabel="Workout options">
                        <IconSymbol name="ellipsis" size={20} color={C.t1} />
                      </Pressable>
                    </View>
                    <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerButton}>
                      <ThemedText style={styles.headerButtonText}>Done</ThemedText>
                    </Pressable>
                  </View>
                )
              : () => (
                  <View style={styles.headerActions}>
                    {!finished ? (
                      <View ref={headerMenuRef} collapsable={false}>
                        <Pressable
                          onPress={() => measureAnchor(headerMenuRef.current, openWorkoutMenu)}
                          hitSlop={8}
                          style={styles.headerButton}
                          accessibilityLabel="Workout options">
                          <IconSymbol name="ellipsis" size={20} color={C.t1} />
                        </Pressable>
                      </View>
                    ) : null}
                    <Pressable onPress={editing ? stopEditing : finish} disabled={busy} hitSlop={8} style={styles.headerButton}>
                      <ThemedText style={styles.headerButtonText}>{editing ? 'Save' : 'Finish'}</ThemedText>
                    </Pressable>
                  </View>
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
            <ThemedText type="caption">{eyebrow}</ThemedText>
            <View style={styles.titleRow}>
              <ThemedText type="title1" style={styles.flex}>
                {workoutDisplayName(workout)}
              </ThemedText>
              {!finished ? (
                <ThemedText num style={styles.counter}>
                  {doneSets}/{totalSets}
                </ThemedText>
              ) : null}
            </View>
            {finished ? null : (
              <View style={styles.progress}>
                {workout.exercises.map((entry) => {
                  const done = entry.sets.filter((set) => set.done).length;
                  const fraction = entry.sets.length ? done / entry.sets.length : 0;
                  return (
                    <View key={entry.id} style={styles.progressSegment}>
                      <View style={[styles.progressFill, { width: `${fraction * 100}%` }]} />
                    </View>
                  );
                })}
              </View>
            )}
            {showNotesField ? (
              <TextInput
                ref={notesRef}
                style={styles.notes}
                value={workout.notes ?? ''}
                onChangeText={(notes) => apply((w) => ({ ...w, notes: notes || undefined }))}
                onBlur={() => setNotesOpen(false)}
                placeholder="Note"
                placeholderTextColor={C.t3}
                keyboardAppearance="dark"
                multiline
              />
            ) : finished && workout.notes ? (
              <ThemedText style={styles.notesText}>{workout.notes}</ThemedText>
            ) : null}
          </View>

          {finished && !editing ? (
            <WorkoutSummary workout={workout} log={gslp.history.find((log) => log.workoutId === workout.id)} />
          ) : null}
          {editing ? (
            <View style={styles.editBanner}>
              <ThemedText style={styles.editBannerText}>Editing the log · GSLP weights stay as they are</ThemedText>
            </View>
          ) : null}

          {finished && !editing
            ? null
            : blocks.map((block) => {
                const cards = block.entries.map((entry) => (
                  <ExerciseCard
                    key={entry.id}
                    entry={entry}
                    previous={previous[entry.exerciseId] ?? []}
                    mainLift={!!entry.slot && entry.slot in gslpLifts}
                    slotLabel={isGslp(workout) ? gslpSlotLabel(entry.slot) : undefined}
                    currentSetId={current?.entryId === entry.id ? current.setId : undefined}
                    choices={isGslp(workout) ? gslpSlotChoices(entry.slot)?.exerciseIds : undefined}
                    onSetChange={(setId, patch: SetPatch) => {
                      apply((w) => updateSet(w, entry.id, setId, patch));
                      const set = entry.sets.find((item) => item.id === setId);
                      if (!finished && patch.done && set) void startRest(restSecFor(entry.exerciseId)); // every set, warm-ups too; Skip is right there
                    }}
                    onSetDelete={(setId) => apply((w) => removeSet(w, entry.id, setId))}
                    onAddSet={() => apply((w) => addSet(w, entry.id))}
                    onChoose={(exerciseId) => swapTo(entry.id, exerciseId)}
                    onMenu={(anchor) => openMenu(entry.id, anchor)}
                    collapsible={!finished}
                    grouped={!!block.letter}
                    tag={supersetTag(blocks, entry.id)}
                  />
                ));
                return block.letter ? (
                  <SupersetGroup key={block.key} members={block.entries}>
                    {cards}
                  </SupersetGroup>
                ) : (
                  cards[0]
                );
              })}

          {!finished || editing ? (
            <Animated.View layout={cardLayout} style={styles.footer}>
              <Button title="Add exercise" variant="secondary" onPress={() => setPicker({ kind: 'add' })} />
              {optionalSlots.map((slot) => (
                <Button
                  key={slot.slot}
                  title={`+ ${slot.label} (optional)`}
                  variant="secondary"
                  onPress={() => addExerciseById(slot.exerciseId, slot.slot)}
                />
              ))}
              {editing ? (
                <Button title="Save Changes" onPress={stopEditing} />
              ) : (
                <Pressable onPress={discard} style={styles.discard}>
                  <ThemedText style={styles.discardText}>Discard workout</ThemedText>
                </Pressable>
              )}
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      {!finished ? <RestBar bottomInset={insets.bottom} next={nextUp} /> : null}

      <ExercisePicker
        visible={picker !== null}
        title={picker?.kind === 'replace' ? 'Replace' : 'Add exercise'}
        {...pickerSlot}
        onClose={() => setPicker(null)}
        onPick={(exerciseId) => {
          const mode = picker;
          setPicker(null);
          if (mode?.kind === 'replace') void swapTo(mode.entryId, exerciseId);
          else void addExerciseById(exerciseId);
        }}
      />
      <ExerciseHistorySheet exerciseId={historyId} onClose={() => setHistoryId(null)} />
      <ActionMenu menu={menu} onClose={() => setMenu(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark.background },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  titleBlock: { gap: 6, paddingHorizontal: 2, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  counter: { ...numStyle, fontSize: 17, color: C.t2, paddingBottom: 4 },
  progress: { flexDirection: 'row', gap: 3, marginTop: 6 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.s3, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: C.accent },
  muted: { color: Colors.dark.textMuted },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerButton: { paddingHorizontal: 8, minHeight: 32, justifyContent: 'center' },
  headerButtonText: { color: C.accent, fontSize: 17, fontWeight: '600' },
  notes: {
    marginTop: 4,
    paddingVertical: 6,
    color: C.t1,
    fontFamily: Fonts.text,
    fontSize: 15,
  },
  notesText: { marginTop: 4, fontSize: 15, color: C.t2 },
  footer: { gap: 12, marginTop: 4 },
  editBanner: { backgroundColor: C.amrapBg, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  editBannerText: { color: C.amrap, fontSize: 14, fontWeight: '600' },
  discard: { alignItems: 'center', paddingVertical: 12 },
  discardText: { color: C.destructive, fontSize: 16 },
});
