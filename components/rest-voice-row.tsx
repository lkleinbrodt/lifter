import { StyleSheet, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import { REST_VOICES, type RestVoice, loadRestVoice, playRestOver, saveRestVoice } from '@/lib/rest-sound';

import { Chip, ListRow } from '@/components/ui/primitives';
import { Radius } from '@/constants/theme';
import { refreshRestNotifications } from '@/lib/session-store';

/** Settings row: which voice says "Rest is over". Tapping a voice also plays it. */
export function RestVoiceRow() {
  const [voice, setVoice] = useState<RestVoice | null>(null);

  useEffect(() => {
    void loadRestVoice().then(setVoice);
  }, []);

  const pick = async (next: RestVoice) => {
    setVoice(next);
    playRestOver(next);
    await saveRestVoice(next);
    refreshRestNotifications();
  };

  return (
    <View style={styles.wrap}>
      <ListRow
        title="Rest voice"
        right={
          <View style={styles.chips}>
            {REST_VOICES.map((v) => (
              <Chip key={v.key} label={v.label} selected={voice === v.key} onPress={() => void pick(v.key)} />
            ))}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.card, overflow: 'hidden' },
  chips: { flexDirection: 'row', gap: 8 },
});
