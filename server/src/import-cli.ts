// Re-import the historical sources into the analytics DB.
//   npm run import            → all three from HISTORY_DIR
//   npm run import -- strong path/to/strong_workouts.csv   (a fresh Strong export)
import './config';

import fs from 'node:fs';
import path from 'node:path';

import { HISTORY_DIR } from './config';
import { DB_PATH, deleteOrigin, getDb, writeWorkouts } from './db';
import { importNotes2023, importSnapshots, importStrong, type ImportResult } from './importers';

const SOURCES = {
  strong: { file: 'strong_workouts.csv', run: importStrong },
  notes: { file: 'notes_2023.csv', run: importNotes2023 },
  snapshot: { file: 'notes_snapshots.csv', run: importSnapshots },
} as const;
type Kind = keyof typeof SOURCES;

const [kind, file] = process.argv.slice(2) as [Kind | undefined, string | undefined];
const kinds: Kind[] = kind ? [kind] : (Object.keys(SOURCES) as Kind[]);
if (kind && !SOURCES[kind]) throw new Error(`Unknown source ${kind}; use ${Object.keys(SOURCES).join(', ')}`);

console.log(`DB: ${DB_PATH}`);
for (const k of kinds) {
  const src = file ?? path.join(HISTORY_DIR, SOURCES[k].file);
  const result: ImportResult = SOURCES[k].run(fs.readFileSync(src, 'utf8'));
  getDb().transaction(() => {
    const removed = deleteOrigin(result.origin);
    writeWorkouts(result.workouts, result.names);
    console.log(`${k}: ${result.workouts.length} workouts, ${result.sets} sets (replaced ${removed}) from ${src}`);
  })();
  const unknown = Object.values(result.names);
  if (unknown.length) console.log(`  not in lib/exercises.ts (kept by name): ${unknown.sort().join(', ')}`);
}
