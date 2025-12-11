import React, { PropsWithChildren } from 'react';

import { Colors } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';

type SafeAreaContainerProps = PropsWithChildren<{
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
}>;

export function SafeAreaContainer({ children, edges = ['top', 'right', 'left'] }: SafeAreaContainerProps) {
  return (
    <ThemedView style={styles.outer}>
      <SafeAreaView style={styles.safe} edges={edges}>
        {children}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  safe: {
    flex: 1,
  },
});
