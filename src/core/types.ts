/** Shared data types, ported 1:1 from the native Android model (BraceObservation.java, SessionStore.java). */

export const SIDE_LEFT = 'L';
export const SIDE_RIGHT = 'R';
export const UNIT_ADC_COUNTS = 'adc_counts';
export const UNCALIBRATED = 'uncalibrated';

export type Side = 'L' | 'R' | '';

/** A finished exercise session (native: SessionStore.Session). */
export interface Session {
  /** Wall-clock time the session started (ms since epoch). */
  startWallMs: number;
  /** Measured elapsed duration (ms). */
  durationMs: number;
  /** Wall-clock time the session finished (stored, or derived for legacy records). */
  finishWallMs: number;
}

/** One recorded observation of a single knee's brace sensor signal (native: BraceObservation.java). */
export interface BraceObservation {
  /** Wall-clock time of the observation (ms since epoch). */
  wallMs: number;
  /** Identifier of the recording session this observation belongs to; aligned pairs share it. */
  sessionId: string;
  /** Which exercise the session was, e.g. "sit_to_stand", or "brace" for standalone records. */
  sessionKey: string;
  /** "L" or "R". */
  side: Side;
  /** Where the record came from: "replay", "fixture", "manual", "ble" … */
  provenance: string;
  /** Unit of the retained samples; only UNIT_ADC_COUNTS is documented. */
  unit: string;
  /** Calibration identity, or UNCALIBRATED. */
  calibration: string;
  /** Retained raw samples, as raw ADC counts. */
  raw: number[];
  /** Valid calibrated angles in degrees; empty when unavailable. */
  angles: number[];
}

export function isLeft(o: BraceObservation): boolean {
  return o.side === SIDE_LEFT;
}

export function isRight(o: BraceObservation): boolean {
  return o.side === SIDE_RIGHT;
}

/** True only when the record names a side we are allowed to label. */
export function hasKnownSide(o: BraceObservation): boolean {
  return isLeft(o) || isRight(o);
}

export function isCalibrated(o: BraceObservation): boolean {
  return !!o.calibration && o.calibration.toLowerCase() !== UNCALIBRATED;
}

/** One point of the Journal charts: a session with the values available for it (native: BraceMetrics.SessionPoint). */
export interface SessionPoint {
  sessionId: string;
  wallMs: number;
  /** Mean raw sensor reading (record unit) for the left side, or NaN when missing. */
  leftMean: number;
  rightMean: number;
  /** Provisional asymmetry %, or NaN when unavailable. */
  asymmetry: number;
  /** ROM in degrees for the left/right side, or NaN when unavailable. */
  leftRom: number;
  rightRom: number;
}

/** Per-day states for the weekly/monthly strips (native: Streak.java). */
export const NO_DATA = 0;
export const MISSED = 1;
export const DONE = 2;
/** Today, not yet saved: still open, never a miss. */
export const OPEN = 3;
export type DayState = typeof NO_DATA | typeof MISSED | typeof DONE | typeof OPEN;
