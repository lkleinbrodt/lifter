export const BAR_WEIGHT = 45;

// 1.25s are microplates — needed for 2.5 lb jumps on upper-body lifts.
const defaultPlates = [45, 35, 25, 10, 5, 2.5, 1.25];

export function roundTo(weight: number, increment: number) {
  const safe = Number.isFinite(weight) ? weight : 0;
  return Math.round(safe / increment) * increment;
}

export function calculatePlateMath(totalWeight: number, barWeight = BAR_WEIGHT, plates = defaultPlates) {
  const safeTotal = Number.isFinite(totalWeight) ? totalWeight : 0;
  const remaining = safeTotal - barWeight;
  if (remaining <= 0) {
    return [];
  }

  let perSide = remaining / 2;
  const selected: number[] = [];

  for (const plate of plates) {
    const count = Math.floor(perSide / plate + 1e-6);
    if (count > 0) {
      selected.push(...Array.from({ length: count }, () => plate));
      perSide = Number((perSide - count * plate).toFixed(2));
    }
  }

  return selected;
}

export function formatPlateMath(weight: number) {
  const plates = calculatePlateMath(weight);
  if (plates.length === 0) {
    return 'Bar only';
  }
  return `Plates per side: ${plates.join(' + ')}`;
}
