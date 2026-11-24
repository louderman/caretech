/**
 * Local-only persistence of timed sessions, ported 1:1 from the native SessionStore.java onto
 * AsyncStorage (maps to localStorage on web). One key per exercise. No network, no account:
 * everything stays on the device.
 *
 * Record format on disk (one string per exercise, records joined by ";"):
 *   new:    startWallMs|durationMs|finishWallMs
 *   legacy: startWallMs|durationMs                (never written by this build, only parsed)
 *
 * Legacy records are never rewritten; their finish time is derived on read as
 * start + measured duration, which is exactly what those two fields represent.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from './types';
import { KEYS } from './exercises';

const PREFIX = 'caretech_sessions:';
const RECORD_SEP = ';';

function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

/** Parses the on-disk record string. Pure, so it is unit-tested directly with real payloads. */
export function parse(raw: string | null | undefined): Session[] {
  const out: Session[] = [];
  if (!raw) return out;
  for (const part of raw.split(RECORD_SEP)) {
    if (!part) continue;
    const f = part.split('|');
    try {
      if (f.length === 3) {
        const startWallMs = parseIntStrict(f[0]);
        const durationMs = parseIntStrict(f[1]);
        const finishWallMs = parseIntStrict(f[2]);
        out.push({ startWallMs, durationMs, finishWallMs });
      } else if (f.length === 2) {
        // Legacy record: no stored finish. start + duration is the finish it actually
        // represents, so derive it here without rewriting.
        const start = parseIntStrict(f[0]);
        const dur = parseIntStrict(f[1]);
        out.push({ startWallMs: start, durationMs: dur, finishWallMs: start + dur });
      }
    } catch {
      // Skip a corrupt record rather than losing the whole history.
    }
  }
  return out;
}

function parseIntStrict(s: string): number {
  if (!/^-?\d+$/.test(s)) throw new Error('not an integer');
  return parseInt(s, 10);
}

/** Records a finished session. finishWallMs is the real wall-clock finish time. */
export async function add(key: string, startWallMs: number, durationMs: number, finishWallMs: number): Promise<void> {
  const cur = (await AsyncStorage.getItem(storageKey(key))) ?? '';
  const entry = `${startWallMs}|${durationMs}|${finishWallMs}`;
  const next = cur === '' ? entry : `${cur}${RECORD_SEP}${entry}`;
  await AsyncStorage.setItem(storageKey(key), next);
}

/** Sessions in the order they were recorded (oldest first). */
export async function get(key: string): Promise<Session[]> {
  return parse(await AsyncStorage.getItem(storageKey(key)));
}

export async function count(key: string): Promise<number> {
  return (await get(key)).length;
}

/** Every saved session across the fixed exercises, in recording order. */
export async function all(): Promise<Session[]> {
  const out: Session[] = [];
  for (const k of KEYS) out.push(...(await get(k)));
  return out;
}

/** True when both wall-clock timestamps fall on the same phone-local calendar day. */
export function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/**
 * Latest finish wall-clock time among sessions that finished on the phone-local calendar day
 * containing refMs, or -1 when none did.
 */
export async function latestFinishToday(key: string, refMs: number): Promise<number> {
  let best = -1;
  for (const s of await get(key)) {
    if (isSameLocalDay(s.finishWallMs, refMs) && s.finishWallMs > best) best = s.finishWallMs;
  }
  return best;
}

export async function doneToday(key: string, refMs: number): Promise<boolean> {
  return (await latestFinishToday(key, refMs)) >= 0;
}

/** How many of the fixed exercises have at least one session finished on refMs's local day. */
export async function doneTodayCount(refMs: number): Promise<number> {
  let n = 0;
  for (const k of KEYS) if (await doneToday(k, refMs)) n++;
  return n;
}
