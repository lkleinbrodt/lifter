import * as Haptics from 'expo-haptics';

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import React, { useEffect, useRef, useState } from 'react';
import { type MenuAnchor, measureAnchor } from '@/components/ui/action-menu';
import { PlateDiagram } from './plate-diagram';
import { ROW_PADDING, SET_COLUMNS, type SetPatch, SetRow, weightHeader } from './set-row';
import { isBarbellExercise, getExercise, splitExerciseName } from '@/lib/exercises';
import { estimated1RM, previousSetFor, setLabels, setScheme, summarizeWorkSets } from '@/lib/workout-edit';

import { C, Radius, numStyle } from '@/constants/theme';
import { Chip } from '@/components/ui/primitives';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import type { WorkoutExercise, WorkoutSet } from '@/lib/workout';

type ExerciseCardProps = {
  entry: WorkoutExercise;
  previous: WorkoutSet[];
  mainLift?: boolean;
  slotLabel?: string;
  choices?: string[]; // catalog ids offered as one-tap swaps (accessory archetype pool)
  /** The workout's current set, when it's in this card. */
  currentSetId?: string;
  onSetChange: (setId: string, patch: SetPatch) => void;
  onSetDelete: (setId: string) => void;
  onAddSet: () => void;
  onChoose: (exerciseId: string) => void;
  onMenu: (anchor: MenuAnchor) => void;
  /** Collapse to one line once every set is checked (off while editing a finished workout). */
  collapsible?: boolean;
  /** Inside a superset group card: no container of its own, and an "A1"-style tag before the name. */
  grouped?: boolean;
  tag?: string;
};

/** Barbell cards show a plate diagram for the current set. Flip to compare against Strong's name-only header. */
const SHOW_PLATE_DIAGRAM = true;

const COLLAPSE_DELAY_MS = 250;

/** Card height eases between expanded and collapsed; cards below slide with it (see the workout screen). */
export const cardLayout = LinearTransition.duration(280).easing(Easing.out(Easing.cubic));

/** The done check fades in with a slight scale, not a bounce. */
function softPop() {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.8 }] },
    animations: {
      opacity: withTiming(1, { duration: 220 }),
      transform: [{ scale: withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }) }],
    },
  };
}

const fmt = (value: number | undefined) => (value === undefined ? '' : String(Number(value.toFixed(2))));

export function ExerciseCard({
  entry,
  previous,
  mainLift,
  slotLabel,
  choices,
  currentSetId,
  onSetChange,
  onSetDelete,
  onAddSet,
  onChoose,
  onMenu,
  collapsible,
  grouped,
  tag,
}: ExerciseCardProps) {
  const exercise = getExercise(entry.exerciseId);
  const { title, detail } = splitExerciseName(exercise.name);
  const barbell = isBarbellExercise(entry.exerciseId);
  const labels = setLabels(entry.sets);
  const header = weightHeader(exercise.tracking);
  const [plates, setPlates] = useState(false);
  const menuRef = useRef<View>(null);
  const reduceMotion = useReducedMotion();

  // Finished exercise: collapses to one line shortly after its last check, with a success
  // haptic and a brief accent glow. Tap to reopen; it re-collapses when its last set is checked again.
  const allDone = !!collapsible && entry.sets.length > 0 && entry.sets.every((set) => set.done);
  const [collapsed, setCollapsed] = useState(allDone); // a resumed workout opens already collapsed
  const [justFinished, setJustFinished] = useState(false);
  const wasDone = useRef(allDone);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (allDone && !wasDone.current) {
      wasDone.current = true;
      const timer = setTimeout(() => {
        setCollapsed(true);
        setJustFinished(true);
        glow.value = 1;
        glow.value = withTiming(0, { duration: 900 });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, COLLAPSE_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (!allDone) {
      wasDone.current = false;
      setCollapsed(false);
    }
  }, [allDone, glow]);
  const glowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(glow.value, [0, 1], [C.s1, '#27322E']),
  }));
  const expand = () => {
    setJustFinished(false);
    setCollapsed(false);
  };

  // Warm-ups collapse to one line once all are checked; tapping it reopens them.
  const warmups = entry.sets.filter((set) => set.type === 'warmup');
  const warmupsDone = warmups.length > 0 && warmups.every((set) => set.done);
  const [warmupsOpen, setWarmupsOpen] = useState(false);
  useEffect(() => {
    if (warmupsDone) setWarmupsOpen(false);
  }, [warmupsDone]);
  const hideWarmups = warmupsDone && !warmupsOpen;

  // The plate diagram follows this card's current set, else its next unchecked set.
  const plateSet = entry.sets.find((set) => set.id === currentSetId) ?? entry.sets.find((set) => !set.done);
  const plateWeight = plateSet?.weight ?? plateSet?.target?.weight;

  const scheme = mainLift ? setScheme(entry.sets) : undefined;
  const subtitle = [detail, mainLift ? scheme : slotLabel].filter(Boolean).join(' · ');
  const showChips = !!choices && choices.length > 1 && !entry.sets.some((set) => set.done);

  // The AMRAP's estimated 1RM rides along on the collapsed line (the badge is hidden once collapsed).
  const amrapSet = entry.sets.find((set) => set.type === 'amrap' && set.done);
  const e1rm = exercise.tracking === 'weightReps' ? estimated1RM(amrapSet?.weight, amrapSet?.reps) : undefined;

  return (
    <Animated.View layout={cardLayout} style={[styles.card, collapsed && styles.cardCollapsed, grouped && styles.cardGrouped, glowStyle]}>
      {collapsed ? (
        <Animated.View key="collapsed" entering={FadeIn.duration(200).delay(80)}>
        <Pressable
          onPress={expand}
          style={({ pressed }) => [styles.collapsedRow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${title}, done`}
          accessibilityHint="Shows the sets">
          <Animated.View entering={justFinished && !reduceMotion ? softPop : undefined} style={styles.doneBadge}>
            <IconSymbol name="checkmark" size={14} weight="bold" color={C.onAccent} />
          </Animated.View>
          <View style={styles.collapsedText}>
            <View style={styles.nameRow}>
              {tag ? <SupersetTag tag={tag} /> : null}
              <ThemedText style={[styles.title, styles.flexShrink]} numberOfLines={1}>
                {title}
              </ThemedText>
            </View>
            <ThemedText num style={styles.collapsedSets} numberOfLines={1}>
              {summarizeWorkSets(entry.sets, exercise.tracking)}
              {e1rm ? (
                <ThemedText style={styles.collapsedE1rm}>
                  {'  ★ e1RM '}
                  <ThemedText num style={styles.collapsedE1rmNum}>
                    {e1rm}
                  </ThemedText>
                </ThemedText>
              ) : null}
            </ThemedText>
          </View>
          <IconSymbol name="chevron.down" size={14} color={C.t4} />
        </Pressable>
        </Animated.View>
      ) : (
      <Animated.View key="expanded" entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.expanded}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <View style={styles.nameRow}>
            {tag ? <SupersetTag tag={tag} /> : null}
            <ThemedText style={[mainLift ? styles.titleMain : styles.title, styles.flexShrink]}>{title}</ThemedText>
          </View>
          {subtitle ? <ThemedText type="subhead">{subtitle}</ThemedText> : null}
          {SHOW_PLATE_DIAGRAM && barbell && plateWeight ? <PlateDiagram weight={plateWeight} /> : null}
        </View>
        <View ref={menuRef} collapsable={false}>
          <Pressable onPress={() => measureAnchor(menuRef.current, onMenu)} style={styles.menu} accessibilityLabel="Exercise options">
            <IconSymbol name="ellipsis" size={20} color={C.t2} />
          </Pressable>
        </View>
      </View>

      {showChips ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {choices.map((id) => {
            const selected = id === entry.exerciseId;
            return <Chip key={id} label={splitExerciseName(getExercise(id).name).title} selected={selected} onPress={() => !selected && onChoose(id)} />;
          })}
        </ScrollView>
      ) : null}

      <View style={styles.columns}>
        <ThemedText type="caption" style={{ width: SET_COLUMNS.label }}>
          Set
        </ThemedText>
        <ThemedText type="caption" style={styles.colPrevious}>
          Prev
        </ThemedText>
        {header ? (
          barbell ? (
            <Pressable
              onPress={() => setPlates((value) => !value)}
              style={styles.colToggle}
              hitSlop={{ top: 10, bottom: 10 }}
              accessibilityRole="button"
              accessibilityLabel={plates ? 'Show pounds' : 'Show plates per side'}>
              <ThemedText type="caption" style={[styles.colHead, plates && styles.colHeadActive]}>
                {plates ? 'Plates' : header}
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="caption" style={[styles.colHead, { width: SET_COLUMNS.weight }]}>
              {header}
            </ThemedText>
          )
        ) : null}
        <ThemedText type="caption" style={[styles.colHead, { width: SET_COLUMNS.reps }]}>
          {exercise.tracking === 'duration' ? 'Sec' : 'Reps'}
        </ThemedText>
        <View style={{ width: SET_COLUMNS.check }} />
      </View>

      {hideWarmups ? (
        <Pressable
          onPress={() => setWarmupsOpen(true)}
          style={({ pressed }) => [styles.warmupLine, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityHint="Shows the warm-up sets">
          <IconSymbol name="checkmark" size={13} weight="bold" color={C.accent} />
          <ThemedText style={styles.warmupLineLabel}>
            Warm-up {warmups.length}/{warmups.length}
          </ThemedText>
          <ThemedText num style={styles.warmupLineSets} numberOfLines={1}>
            {warmups.map((set) => `${fmt(set.weight)}×${fmt(set.reps)}`).join(' · ')}
          </ThemedText>
        </Pressable>
      ) : null}

      {entry.sets.map((set, index) =>
        hideWarmups && set.type === 'warmup' ? null : (
          <SetRow
            key={set.id}
            label={labels[index]}
            set={set}
            previous={previousSetFor(entry.sets, index, previous)}
            tracking={exercise.tracking}
            current={set.id === currentSetId}
            plates={barbell && plates}
            separator={index > 0 && !(hideWarmups && entry.sets[index - 1]?.type === 'warmup')}
            onChange={(patch) => onSetChange(set.id, patch)}
            onDelete={() => onSetDelete(set.id)}
          />
        ),
      )}

      <View style={styles.footer}>
        <Pressable onPress={onAddSet} style={({ pressed }) => [styles.addSet, pressed && styles.pressed]} accessibilityRole="button">
          <ThemedText style={styles.addSetText}>+ Set</ThemedText>
        </Pressable>
      </View>
      </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.s1,
    borderRadius: Radius.card,
    overflow: 'hidden',
    paddingTop: 14,
  },
  cardGrouped: { backgroundColor: 'transparent', borderRadius: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flexShrink: { flexShrink: 1 },
  tag: { height: 22, minWidth: 28, paddingHorizontal: 6, borderRadius: 6, backgroundColor: C.supersetBg, alignItems: 'center', justifyContent: 'center' },
  tagText: { ...numStyle, fontSize: 12, fontWeight: '700', color: C.superset },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 16,
    paddingRight: 6,
    gap: 8,
  },
  titleBlock: { flex: 1, gap: 2, paddingTop: 2 },
  titleMain: { fontSize: 19, lineHeight: 24, fontWeight: '600' },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  cardCollapsed: { paddingTop: 0 },
  expanded: {},
  collapsedE1rm: { fontSize: 14, color: C.accent },
  collapsedE1rmNum: { ...numStyle, fontSize: 15, color: C.accent },
  collapsedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  doneBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  collapsedText: { flex: 1, gap: 2 },
  collapsedSets: { ...numStyle, fontSize: 15, color: C.t2 },
  menu: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -8 },
  chips: { gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ROW_PADDING,
    paddingTop: 14,
    paddingBottom: 6,
  },
  colHead: { textAlign: 'center' },
  colHeadActive: { color: C.accent },
  colPrevious: { flex: 1, textAlign: 'center' },
  colToggle: { width: SET_COLUMNS.weight, alignItems: 'center' },
  warmupLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  warmupLineLabel: { fontSize: 15, color: C.t2 },
  warmupLineSets: { flex: 1, fontSize: 14, color: C.t3, textAlign: 'right' },
  footer: { flexDirection: 'row', paddingHorizontal: 6 },
  addSet: { height: 44, paddingHorizontal: 10, justifyContent: 'center' },
  addSetText: { fontSize: 15, fontWeight: '600', color: C.t2 },
  pressed: { opacity: 0.6 },
});

function SupersetTag({ tag }: { tag: string }) {
  return (
    <View style={styles.tag}>
      <ThemedText num style={styles.tagText}>
        {tag}
      </ThemedText>
    </View>
  );
}
