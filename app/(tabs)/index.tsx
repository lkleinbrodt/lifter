import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { LiftKey, Maxes, defaultMaxes, loadMaxes, saveMaxes } from '@/lib/storage';
import React, { useCallback, useState } from 'react';
import { getLiftLabel, trainingMax } from '@/lib/workout-plan';
import { useFocusEffect } from '@react-navigation/native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
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
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLift, setSelectedLift] = useState<LiftKey | null>(null);
  const [oneRepMaxInput, setOneRepMaxInput] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        const stored = await loadMaxes();
        if (active) {
          setMaxes(stored);
          setLoading(false);
        }
      };
      load();
      return () => {
        active = false;
      };
    }, []),
  );

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

  const handleOpenModal = useCallback((lift: LiftKey) => {
    setSelectedLift(lift);
    setOneRepMaxInput('');
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedLift(null);
    setOneRepMaxInput('');
  }, []);

  const handleCalculateTrainingMax = useCallback(() => {
    if (!selectedLift) return;
    const oneRepMax = Number(oneRepMaxInput.replace(/[^0-9]/g, ''));
    if (!oneRepMax || !Number.isFinite(oneRepMax)) return;
    
    const calculated = Math.round(trainingMax(oneRepMax));
    const next = { ...maxes, [selectedLift]: calculated };
    setMaxes(next);
    void persist(next);
    handleCloseModal();
  }, [maxes, oneRepMaxInput, selectedLift, persist, handleCloseModal]);

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
                Training Maxes
              </ThemedText>
              <ThemedText style={styles.subtle}>
                Edit your training max directly or calculate it from a 1RM.
              </ThemedText>

              {liftOrder.map((lift) => {
                const tm = maxes[lift] ?? 0;
                return (
                  <Card key={lift} style={styles.card}>
                    <View style={styles.inputRow}>
                      <View style={styles.inputContainer}>
                        <Input
                          label={`${getLiftLabel(lift)} Training Max`}
                          suffix="lbs"
                          value={tm ? String(tm) : ''}
                          onChangeText={(text) => handleChange(lift, text)}
                          onBlur={() => handleBlur(lift)}
                          keyboardType="number-pad"
                          inputMode="numeric"
                        />
                      </View>
                      <Pressable
                        onPress={() => handleOpenModal(lift)}
                        style={styles.ellipsisButton}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Calculate from 1RM">
                        <IconSymbol name="ellipsis.circle" size={24} color={Colors.dark.icon} />
                      </Pressable>
                    </View>
                  </Card>
                );
              })}

              <Card style={styles.card}>
                <View style={styles.inputContainer}>
                  <Input
                    label="Weighted Pull-Ups (5x5 weight)"
                    suffix="lbs"
                    value={maxes.weightedPullupWeight ? String(maxes.weightedPullupWeight) : ''}
                    onChangeText={(text) => {
                      const numeric = Number(text.replace(/[^0-9]/g, ''));
                      setMaxes((prev) => ({
                        ...prev,
                        weightedPullupWeight: Number.isFinite(numeric) ? numeric : 0,
                      }));
                    }}
                    onBlur={() => {
                      const next = { ...maxes };
                      if (!Number.isFinite(next.weightedPullupWeight)) {
                        next.weightedPullupWeight = 0;
                      }
                      void persist(next);
                    }}
                    keyboardType="number-pad"
                    inputMode="numeric"
                  />
                </View>
              </Card>

              {status ? <ThemedText style={styles.status}>{status}</ThemedText> : null}
            </ScrollView>

            <Modal
              visible={modalVisible}
              transparent
              animationType="fade"
              onRequestClose={handleCloseModal}>
              <Pressable style={styles.modalOverlay} onPress={handleCloseModal}>
                <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                  <View style={styles.modalHeader}>
                    <ThemedText type="title">
                      Calculate Training Max from 1RM
                    </ThemedText>
                    {selectedLift && (
                      <ThemedText style={styles.modalSubtitle}>
                        {getLiftLabel(selectedLift)}
                      </ThemedText>
                    )}
                  </View>
                  
                  <Input
                    label="1RM"
                    suffix="lbs"
                    value={oneRepMaxInput}
                    onChangeText={setOneRepMaxInput}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    autoFocus
                  />
                  
                  <View style={styles.modalButtons}>
                    <Button
                      title="Cancel"
                      variant="secondary"
                      onPress={handleCloseModal}
                      style={styles.modalButton}
                    />
                    <Button
                      title="Calculate"
                      onPress={handleCalculateTrainingMax}
                      disabled={!oneRepMaxInput || Number(oneRepMaxInput.replace(/[^0-9]/g, '')) === 0}
                      style={styles.modalButton}
                    />
                  </View>
                </Pressable>
              </Pressable>
            </Modal>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
  },
  ellipsisButton: {
    paddingTop: 8,
    paddingLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 20,
  },
  modalHeader: {
    gap: 4,
  },
  modalSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
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
