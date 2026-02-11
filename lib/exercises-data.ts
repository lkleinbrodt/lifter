export type PrimaryArchetype = 'Vertical Pull' | 'Vertical Push' | 'Horizontal Pull' | 'Horizontal Push' | 'Squat' | 'Hinge' | 'Misc';

export type Exercise = {
  name: string;
  tags: string[];
  primaryArchetype: PrimaryArchetype;
};

/**
 * All exercises with their tags and primary archetype.
 * This is the single source of truth for exercise data.
 */
export const EXERCISES: Exercise[] = [
  // Upper Body Push - Horizontal
  {
    name: 'DB incline press',
    tags: ['Horizontal Push'],
    primaryArchetype: 'Horizontal Push',
  },
  {
    name: 'Push-ups',
    tags: ['Horizontal Push'],
    primaryArchetype: 'Horizontal Push',
  },
  {
    name: 'Close-grip bench press',
    tags: ['Horizontal Push'],
    primaryArchetype: 'Horizontal Push',
  },
  
  // Upper Body Push - Vertical
  {
    name: 'Landmine press',
    tags: ['Vertical Push', 'Vertical Press'],
    primaryArchetype: 'Vertical Push',
  },
  {
    name: 'Dumbbell Z-press',
    tags: ['Vertical Push', 'Vertical Press'],
    primaryArchetype: 'Vertical Push',
  },
  {
    name: 'Seated DB overhead press',
    tags: ['Vertical Push', 'Vertical Press'],
    primaryArchetype: 'Vertical Push',
  },
  {
    name: 'Kettlebell press',
    tags: ['Vertical Push', 'Vertical Press'],
    primaryArchetype: 'Vertical Push',
  },
  
  // Upper Body Push - Isolation
  {
    name: 'Lateral Raises',
    tags: ['Isolation / Hypertrophy', 'Vertical Press'],
    primaryArchetype: 'Vertical Push',
  },
  {
    name: 'Triceps pushdowns',
    tags: ['Isolation / Hypertrophy'],
    primaryArchetype: 'Misc',
  },
  {
    name: 'Dips',
    tags: ['Isolation / Hypertrophy', 'Vertical Push'],
    primaryArchetype: 'Vertical Push',
  },
  
  // Upper Body Pull - Horizontal
  {
    name: 'Barbell row',
    tags: ['Horizontal Pull', 'Horizontal Row'],
    primaryArchetype: 'Horizontal Pull',
  },
  {
    name: 'DB row',
    tags: ['Horizontal Pull', 'Horizontal Row'],
    primaryArchetype: 'Horizontal Pull',
  },
  {
    name: 'Gorilla Rows',
    tags: ['Horizontal Pull', 'Horizontal Row'],
    primaryArchetype: 'Horizontal Pull',
  },
  {
    name: 'Seated cable row',
    tags: ['Horizontal Pull', 'Horizontal Row', 'Row (supported)'],
    primaryArchetype: 'Horizontal Pull',
  },
  
  // Upper Body Pull - Vertical
  {
    name: 'Pull-ups',
    tags: ['Vertical Pull'],
    primaryArchetype: 'Vertical Pull',
  },
  {
    name: 'Chin-ups',
    tags: ['Vertical Pull'],
    primaryArchetype: 'Vertical Pull',
  },
  {
    name: 'Lat pulldowns',
    tags: ['Vertical Pull'],
    primaryArchetype: 'Vertical Pull',
  },
  
  // Upper Body Pull - Upper Back
  {
    name: 'Face pulls',
    tags: ['Upper-Back / Rear Delt / Scapular Stability'],
    primaryArchetype: 'Horizontal Pull',
  },
  {
    name: 'Band pull-aparts',
    tags: ['Upper-Back / Rear Delt / Scapular Stability'],
    primaryArchetype: 'Horizontal Pull',
  },
  {
    name: 'Rear-delt fly',
    tags: ['Upper-Back / Rear Delt / Scapular Stability'],
    primaryArchetype: 'Misc',
  },
  {
    name: 'Shrugs',
    tags: ['Upper-Back / Rear Delt / Scapular Stability'],
    primaryArchetype: 'Misc',
  },
  
  // Lower Body - Unilateral Quad Dominant
  {
    name: 'ATG Split Squats',
    tags: ['Squat Pattern', 'Quad Dominant', 'Unilateral'],
    primaryArchetype: 'Squat',
  },
  {
    name: 'Bulgarian split squats',
    tags: ['Squat Pattern', 'Quad Dominant', 'Unilateral'],
    primaryArchetype: 'Squat',
  },
  {
    name: 'Goblet split squat',
    tags: ['Squat Pattern', 'Quad Dominant', 'Unilateral'],
    primaryArchetype: 'Squat',
  },
  {
    name: 'Poliquin Stepdowns',
    tags: ['Squat Pattern', 'Quad Dominant', 'Unilateral'],
    primaryArchetype: 'Squat',
  },
  
  // Lower Body - Unilateral Hip Dominant
  {
    name: 'Single-Leg RDL',
    tags: ['Hinge Pattern', 'Glute / Hip-Dominant', 'Unilateral'],
    primaryArchetype: 'Hinge',
  },
  {
    name: 'Cossack Squats',
    tags: ['Squat Pattern', 'Glute / Hip-Dominant', 'Unilateral'],
    primaryArchetype: 'Squat',
  },
  
  // Lower Body - Bilateral Quad
  {
    name: 'Leg press',
    tags: ['Squat Pattern', 'Quad Dominant'],
    primaryArchetype: 'Squat',
  },
  
  // Lower Body - Bilateral Hip/Hamstring
  {
    name: 'RDL',
    tags: ['Hinge Pattern', 'Glutes / Hamstrings'],
    primaryArchetype: 'Hinge',
  },
  {
    name: 'Hip thrusts',
    tags: ['Hinge Pattern', 'Glutes / Hamstrings'],
    primaryArchetype: 'Hinge',
  },
  {
    name: 'Glute bridges',
    tags: ['Hinge Pattern', 'Glutes / Hamstrings'],
    primaryArchetype: 'Hinge',
  },
  {
    name: 'Back extensions',
    tags: ['Hinge Pattern', 'Glutes / Hamstrings', 'Hinge Integration', 'Secondary Hinge (low-back friendly)'],
    primaryArchetype: 'Hinge',
  },
  {
    name: 'Hamstring curls',
    tags: ['Glutes / Hamstrings'],
    primaryArchetype: 'Hinge',
  },
  
  // Core - Anti-Extension
  {
    name: 'Planks',
    tags: ['Core (Anti-extension)', 'Core', 'Anti-Extension / Anti-Flexion'],
    primaryArchetype: 'Misc',
  },
  {
    name: 'Leg Raises',
    tags: ['Core (Anti-extension)', 'Core', 'Anti-Extension / Anti-Flexion'],
    primaryArchetype: 'Misc',
  },
  {
    name: 'Ab-wheel rollouts',
    tags: ['Core (Anti-extension)', 'Core', 'Anti-Extension / Anti-Flexion'],
    primaryArchetype: 'Misc',
  },
  
  // Core - Anti-Rotation
  {
    name: 'Pallof Press',
    tags: ['Core (Anti-rotation)', 'Core', 'Anti-Rotation / Anti-Lateral Flexion'],
    primaryArchetype: 'Misc',
  },
  {
    name: 'Side Planks',
    tags: ['Core (Anti-rotation)', 'Core', 'Anti-Rotation / Anti-Lateral Flexion'],
    primaryArchetype: 'Misc',
  },
  {
    name: 'Suitcase Carries',
    tags: ['Core (Anti-rotation)', 'Core', 'Anti-Rotation / Anti-Lateral Flexion'],
    primaryArchetype: 'Misc',
  },
  {
    name: 'Farmer Carries',
    tags: ['Core (Anti-rotation)', 'Core', 'Anti-Rotation / Anti-Lateral Flexion'],
    primaryArchetype: 'Misc',
  },
  
  // Core - Hinge Integration
  {
    name: 'Reverse hypers',
    tags: ['Hinge Integration', 'Secondary Hinge (low-back friendly)'],
    primaryArchetype: 'Hinge',
  },
  {
    name: 'Hip extensions with pause',
    tags: ['Hinge Integration', 'Secondary Hinge (low-back friendly)'],
    primaryArchetype: 'Hinge',
  },
  {
    name: 'Seated Good Mornings',
    tags: ['Hinge Integration', 'Secondary Hinge (low-back friendly)'],
    primaryArchetype: 'Hinge',
  },
];

/**
 * Get all exercises that have a specific tag
 */
export function getExercisesByTag(tag: string): Exercise[] {
  return EXERCISES.filter((exercise) => exercise.tags.includes(tag));
}

/**
 * Get all exercises grouped by primary archetype
 */
export function getExercisesByPrimaryArchetype(): Record<PrimaryArchetype, Exercise[]> {
  const grouped: Record<PrimaryArchetype, Exercise[]> = {
    'Vertical Pull': [],
    'Vertical Push': [],
    'Horizontal Pull': [],
    'Horizontal Push': [],
    'Squat': [],
    'Hinge': [],
    'Misc': [],
  };
  
  for (const exercise of EXERCISES) {
    grouped[exercise.primaryArchetype].push(exercise);
  }
  
  return grouped;
}

/**
 * Get all unique tags across all exercises
 */
export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  for (const exercise of EXERCISES) {
    for (const tag of exercise.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}
