import { StyleSheet, View } from 'react-native';

import { C, numStyle } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { calculatePlateMath } from '@/lib/plates';

// One side of the bar, loaded: neutral grey plates sized by weight, each labeled.

const PLATE: Record<number, { height: number; color: string }> = {
  45: { height: 46, color: '#4B5258' },
  35: { height: 42, color: '#464D53' },
  25: { height: 37, color: '#41484D' },
  10: { height: 30, color: '#596066' },
  5: { height: 25, color: '#61686E' },
  2.5: { height: 22, color: '#6A7177' },
  1.25: { height: 20, color: '#72797F' },
};

const label = (plate: number) => String(plate);

/** `compact`: small, plates only (no total), for the rest bar's Next line. */
export function PlateDiagram({ weight, compact }: { weight: number; compact?: boolean }) {
  const plates = calculatePlateMath(weight);
  const total = Number.isInteger(weight) ? String(weight) : String(Number(weight.toFixed(2)));
  return (
    <View
      style={[styles.row, compact && styles.rowCompact]}
      accessibilityLabel={`${total} pounds${plates.length ? `, ${plates.join(', ')} per side` : ', empty bar'}`}>
      {compact ? null : (
      <View style={styles.total}>
        <ThemedText num style={styles.totalNumber}>
          {total}
        </ThemedText>
        <ThemedText style={styles.totalUnit}>lb</ThemedText>
      </View>
      )}
      <View style={[styles.bar, compact && styles.barCompact]}>
        <View style={styles.sleeve} />
        <View style={styles.collar} />
        {plates.length === 0 ? (
          <ThemedText style={styles.empty}>empty bar</ThemedText>
        ) : (
          plates.map((plate, index) => {
            const spec = PLATE[plate] ?? PLATE[1.25];
            return (
              <View
                key={index}
                style={[
                  styles.plate,
                  {
                    height: compact ? Math.round(spec.height * 0.6) : spec.height,
                    backgroundColor: spec.color,
                    minWidth: compact ? Math.max(16, label(plate).length * 5.6 + 4) : Math.max(20, label(plate).length * 6.5 + 6),
                  },
                ]}>
                <ThemedText num style={[styles.plateLabel, compact && styles.plateLabelCompact]}>
                  {label(plate)}
                </ThemedText>
              </View>
            );
          })
        )}
        {plates.length ? <View style={styles.stub} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  total: { flexDirection: 'row', alignItems: 'baseline', gap: 3, minWidth: 58 },
  totalNumber: { ...numStyle, fontSize: 22, fontWeight: '600', color: C.t1 },
  totalUnit: { fontSize: 13, color: C.t3 },
  bar: { flexDirection: 'row', alignItems: 'center', height: 48 },
  rowCompact: { marginTop: 0 },
  barCompact: { height: 30 },
  plateLabelCompact: { fontSize: 9 },
  sleeve: { width: 22, height: 5, borderRadius: 1, backgroundColor: C.t4 },
  collar: { width: 5, height: 14, borderRadius: 1.5, backgroundColor: C.t3, marginRight: 2 },
  plate: {
    marginRight: 2,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  plateLabel: { ...numStyle, fontSize: 10, fontWeight: '700', color: C.t1 },
  stub: { width: 12, height: 5, borderTopRightRadius: 2, borderBottomRightRadius: 2, backgroundColor: C.t4 },
  empty: { fontSize: 13, color: C.t3, marginLeft: 8 },
});
