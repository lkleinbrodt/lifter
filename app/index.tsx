import * as Haptics from 'expo-haptics';

import { Pressable, StyleSheet, View } from 'react-native';
import { type Program, getProgram, loadActiveProgram, programs, saveActiveProgram } from '@/lib/programs';
import React, { useEffect, useState } from 'react';

import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SafeAreaContainer } from '@/components/safe-area';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useNavigation, useRouter } from 'expo-router';

// Only jump straight into the last program on cold start; after that, visiting "/" shows the picker.
let didAutoOpen = false;

export default function ProgramPickerScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [ready, setReady] = useState(didAutoOpen);

  useEffect(() => {
    if (didAutoOpen) return;
    didAutoOpen = true;
    // Deep links mount this screen underneath the target route; don't redirect away from it.
    if (!navigation.isFocused()) {
      setReady(true);
      return;
    }
    loadActiveProgram().then((active) => {
      if (active) {
        router.replace(getProgram(active).href);
      } else {
        setReady(true);
      }
    });
  }, [navigation, router]);

  const handleSelect = (program: Program) => {
    void Haptics.selectionAsync();
    void saveActiveProgram(program.key);
    router.replace(program.href);
  };

  if (!ready) {
    return <ThemedView style={styles.container} />;
  }

  return (
    <SafeAreaContainer edges={['top', 'left', 'right', 'bottom']}>
      <ThemedView style={[styles.container, styles.content]}>
        <ThemedText type="display">Programs</ThemedText>
        <ThemedText style={styles.subtle}>
          Pick a program. The app reopens to your last choice.
        </ThemedText>
        {programs.map((program) => (
          <Pressable key={program.key} onPress={() => handleSelect(program)} accessibilityRole="button">
            {({ pressed }) => (
              <Card style={[styles.card, pressed && styles.cardPressed]}>
                <View style={styles.cardText}>
                  <ThemedText type="title">{program.name}</ThemedText>
                  <ThemedText style={styles.subtle}>{program.description}</ThemedText>
                </View>
                <IconSymbol name="chevron.right" size={20} color={Colors.dark.icon} />
              </Card>
            )}
          </Pressable>
        ))}
      </ThemedView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  subtle: {
    color: Colors.dark.textMuted,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
});
