/**
 * Local-only persistence of brace observations, ported 1:1 from the native ObservationStore.java
 * onto AsyncStorage (a single newline-joined record under one key). No network, no account.
 * Nothing is ever converted on write: raw samples stay raw.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BraceObservation } from './types';
import { encode, decodeAll } from './braceCodec';

const KEY = 'caretech_observations';

/** Appends one observation. Existing records are never rewritten or migrated. */
export async function add(o: BraceObservation): Promise<void> {
  if (!o) return;
  const cur = (await AsyncStorage.getItem(KEY)) ?? '';
  const entry = encode(o);
  const next = cur === '' ? entry : `${cur}\n${entry}`;
  await AsyncStorage.setItem(KEY, next);
}

/** All persisted observations, oldest first as written. */
export async function all(): Promise<BraceObservation[]> {
  return decodeAll(await AsyncStorage.getItem(KEY));
}

/** Number of persisted observations (0 on a fresh install). */
export async function count(): Promise<number> {
  return (await all()).length;
}

/**
 * Imports a replay blob (see braceCodec.ts). Returns the number of observations added;
 * malformed lines are skipped rather than aborting the import.
 */
export async function importReplay(blob: string): Promise<number> {
  let added = 0;
  for (const o of decodeAll(blob)) {
    await add(o);
    added++;
  }
  return added;
}
