// GSLP Settings tab: the program's weights, a switch back to the program picker, then the dev sections.

import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import React, { useCallback, useState } from 'react';
import { type GslpState, defaultGslpState } from '@/lib/gslp';
import { gslpLiftHistory } from '@/lib/workout-actions';
import { loadGslpState, saveGslpState } from '@/lib/gslp-storage';
import { useFocusEffect, useRouter } from 'expo-router';

import { C, Radius } from '@/constants/theme';
import { DevSettings } from '@/components/dev-settings';
import { GslpWeightsSection, type LiftSessions } from '@/components/gslp-weights';
import { ListRow } from '@/components/ui/primitives';
import { ProgramHeader } from '@/components/program-header';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GslpSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [state, setState] = useState<GslpState | null>(null);
  const [sessions, setSessions] = useState<LiftSessions>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadGslpState().then((stored) => active && setState(stored));
      gslpLiftHistory().then((history) => active && setSessions(history));
      return () => {
        active = false;
      };
    }, []),
  );

  const update = useCallback((next: GslpState) => {
    setState(next);
    void saveGslpState(next);
  }, []);

  return (
    <SafeAreaContainer edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <ProgramHeader title="Settings" />
          <GslpWeightsSection state={state ?? defaultGslpState} sessions={sessions} onChange={update} />
          <View style={styles.programRow}>
            <ListRow
              title="Program"
              right={<ThemedText style={styles.programValue}>GSLP</ThemedText>}
              onPress={() => router.replace('/')}
            />
          </View>
          <DevSettings />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, gap: 20 },
  programRow: { borderRadius: Radius.card, overflow: 'hidden' },
  programValue: { fontSize: 17, color: C.t2 },
});
