/**
 * Text codec for brace observations — the "injectable / replay" path, ported 1:1 from the
 * native BraceCodec.java.
 *
 * Because the live sensor contract is unverified, this build does not decode a live brace
 * stream. It records from a documented, human-readable replay text instead, one observation per
 * line, fields separated by "|":
 *
 *   wallMs|sessionId|sessionKey|side|provenance|unit|calibration|rawCsv|angleCsv
 *
 * `rawCsv` is a ";"-separated list of raw ADC counts; `angleCsv` a ";" separated list of valid
 * calibrated angles (empty when unavailable). Parsing is deliberately lenient: a truncated or
 * older line yields a usable observation with `uncalibrated` and no angles rather than a crash,
 * and a wholly malformed line is skipped so one bad record cannot destroy the rest of the
 * history.
 */

import type { BraceObservation, Side } from './types';
import { UNCALIBRATED } from './types';

const LIST = ';';

export function encode(o: BraceObservation): string {
  return (
    `${o.wallMs}|${o.sessionId}|${o.sessionKey}|${o.side}|${o.provenance}|${o.unit}|${o.calibration}|` +
    `${joinInts(o.raw)}|${joinDoubles(o.angles)}`
  );
}

/** Parses one replay/changelog blob into observations, skipping malformed lines. */
export function decodeAll(blob: string | null | undefined): BraceObservation[] {
  const out: BraceObservation[] = [];
  if (!blob) return out;
  for (const line of blob.split('\n')) {
    const o = decode(line);
    if (o) out.push(o);
  }
  return out;
}

/** Parses one observation line, or returns null when it is not usable at all. */
export function decode(line: string | null | undefined): BraceObservation | null {
  if (line == null) return null;
  const s = line.trim();
  if (s === '') return null;
  const f = s.split('|');
  if (f.length < 4) return null;
  const wallMs = Number(f[0].trim());
  if (Number.isNaN(wallMs) || !/^-?\d+$/.test(f[0].trim())) return null;
  const sessionId = f[1].trim();
  const sessionKey = f[2].trim();
  const side = f[3].trim() as Side;
  // Older / truncated records: keep them usable, just with the safe defaults.
  const provenance = f.length > 4 ? f[4].trim() : '';
  const unit = f.length > 5 ? f[5].trim() : '';
  let calibration = f.length > 6 ? f[6].trim() : '';
  if (calibration === '') calibration = UNCALIBRATED;
  const raw = f.length > 7 ? parseInts(f[7]) : [];
  const angles = f.length > 8 ? parseDoubles(f[8]) : [];
  return { wallMs, sessionId, sessionKey, side, provenance, unit, calibration, raw, angles };
}

export function joinInts(v: number[]): string {
  return v.join(LIST);
}

export function joinDoubles(v: number[]): string {
  return v.map(formatDouble).join(LIST);
}

/** Locale-independent, trimmed double formatting (no thousands separators). */
export function formatDouble(d: number): string {
  if (Number.isNaN(d) || !Number.isFinite(d)) return '';
  let s = d.toFixed(4);
  while (s.includes('.') && s.endsWith('0')) s = s.slice(0, -1);
  if (s.endsWith('.')) s = s.slice(0, -1);
  return s;
}

function parseInts(csv: string | null | undefined): number[] {
  const out: number[] = [];
  if (!csv || csv.trim() === '') return out;
  for (const p of csv.split(LIST)) {
    const t = p.trim();
    if (t === '') continue;
    if (!/^-?\d+$/.test(t)) continue; // Skip a single corrupt sample rather than the whole record.
    out.push(parseInt(t, 10));
  }
  return out;
}

function parseDoubles(csv: string | null | undefined): number[] {
  const out: number[] = [];
  if (!csv || csv.trim() === '') return out;
  for (const p of csv.split(LIST)) {
    const t = p.trim();
    if (t === '') continue;
    const d = Number(t);
    if (!/^-?\d+(\.\d+)?$/.test(t) || Number.isNaN(d) || !Number.isFinite(d)) continue;
    out.push(d);
  }
  return out;
}
