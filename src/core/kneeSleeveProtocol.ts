/**
 * Pure decode/convert functions for the real KneeSleeve hardware (ESP32-C3 + 2x SF15-100),
 * per docs/hardware/BLE_PROTOCOL.md. Nothing here touches BLE, React Native, or the DOM — it
 * is plain data-in/data-out so it can be unit tested with hand-built byte arrays and reused
 * by both the native (react-native-ble-plx) and web (Web Bluetooth) adapters.
 *
 * IMPORTANT — never guessed: every UUID, offset, field and formula below is copied verbatim
 * from docs/hardware/BLE_PROTOCOL.md. If the doc doesn't say it, this file doesn't invent it;
 * see the "Protocol ambiguities" list at the bottom for what the doc leaves unanswered.
 */

// ---------------------------------------------------------------------------
// Identifiers (verbatim from docs/hardware/BLE_PROTOCOL.md)
// ---------------------------------------------------------------------------

/** The name the firmware advertises. Not unique — see ambiguity #1 below. */
export const ADVERTISED_NAME = 'KneeSleeve';

export const SERVICE_UUID = '8f1d0001-6b2e-4c3a-9a5e-2f0c1d4b7a10';
export const DATA_CHARACTERISTIC_UUID = '8f1d0002-6b2e-4c3a-9a5e-2f0c1d4b7a10';
/** Write-only in this app. Never written to — receive-only per spec. Exported for documentation only. */
export const CONTROL_CHARACTERISTIC_UUID = '8f1d0003-6b2e-4c3a-9a5e-2f0c1d4b7a10';
export const INFO_CHARACTERISTIC_UUID = '8f1d0004-6b2e-4c3a-9a5e-2f0c1d4b7a10';

/** Exact wire length of a Data notification. Any other length is rejected, never truncated/padded. */
export const DATA_PACKET_LENGTH = 13;

/** Android MTU request recommended by the doc so Info can arrive as a notification too. */
export const RECOMMENDED_MTU = 185;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One decoded 13-byte Data notification, before unit conversion. */
export interface KneeSleeveSample {
  seq: number;
  tMs: number;
  mvA: number;
  mvB: number;
  battMv: number;
  flags: number;
  clippedA: boolean;
  clippedB: boolean;
  lowBattery: boolean;
}

export type DecodeResult =
  | { ok: true; sample: KneeSleeveSample }
  | { ok: false; error: string; receivedLength: number };

/** Parsed Info characteristic (`fw=1.0;rate=50;stream=1;rf=10000;vcc=3300;clip=2500`). */
export interface KneeSleeveInfo {
  /** Every key=value pair seen, raw strings, for forward-compat with unknown keys. */
  raw: Record<string, string>;
  fw: string | null;
  rateHz: number | null;
  streaming: boolean | null;
  /** Fixed divider resistor, ohms. Required to convert mV -> ohms. */
  rfOhm: number | null;
  /** Supply voltage, mV. Required to convert mV -> ohms. */
  vccMv: number | null;
  /** Clip threshold, mV. Falls back to the flag bits alone when absent. */
  clipMv: number | null;
  /** Keys required for unit conversion (rf, vcc) that were missing or unparseable. */
  missingForConversion: string[];
}

/** One channel (A or B) converted to physical units, or null when conversion isn't possible. */
export interface KneeSleeveReading {
  ohmsA: number | null;
  microsiemensA: number | null;
  ohmsB: number | null;
  microsiemensB: number | null;
  /** True once mvA/mvB are at or above info.clipMv (or the firmware's own flag, whichever fires first). */
  clippedA: boolean;
  clippedB: boolean;
}

// ---------------------------------------------------------------------------
// Data packet decode
// ---------------------------------------------------------------------------

/**
 * Decodes one 13-byte little-endian Data notification. Rejects (ok: false) any length other
 * than DATA_PACKET_LENGTH — never silently truncates or pads, per the task spec.
 */
export function decodeDataPacket(bytes: ArrayLike<number>): DecodeResult {
  const length = bytes.length;
  if (length !== DATA_PACKET_LENGTH) {
    return {
      ok: false,
      error: `expected a ${DATA_PACKET_LENGTH}-byte Data packet, got ${length} bytes`,
      receivedLength: length,
    };
  }
  const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  const view = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);

  const seq = view.getUint16(0, true);
  const tMs = view.getUint32(2, true);
  const mvA = view.getUint16(6, true);
  const mvB = view.getUint16(8, true);
  const battMv = view.getUint16(10, true);
  const flags = view.getUint8(12);

  return {
    ok: true,
    sample: {
      seq,
      tMs,
      mvA,
      mvB,
      battMv,
      flags,
      clippedA: (flags & 0x01) !== 0,
      clippedB: (flags & 0x02) !== 0,
      lowBattery: (flags & 0x04) !== 0,
    },
  };
}

/** Builds the 13-byte wire packet from field values. Only used by tests, to construct fixtures. */
export function encodeDataPacketForTest(fields: Omit<KneeSleeveSample, 'clippedA' | 'clippedB' | 'lowBattery'>): Uint8Array {
  const buf = new Uint8Array(DATA_PACKET_LENGTH);
  const view = new DataView(buf.buffer);
  view.setUint16(0, fields.seq, true);
  view.setUint32(2, fields.tMs, true);
  view.setUint16(6, fields.mvA, true);
  view.setUint16(8, fields.mvB, true);
  view.setUint16(10, fields.battMv, true);
  view.setUint8(12, fields.flags);
  return buf;
}

// ---------------------------------------------------------------------------
// Info string parse
// ---------------------------------------------------------------------------

function toNumber(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Parses the semicolon-separated `key=value` Info string. Never throws on malformed input. */
export function parseInfoString(infoText: string): KneeSleeveInfo {
  const raw: Record<string, string> = {};
  for (const part of (infoText ?? '').split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim().toLowerCase();
    const value = trimmed.slice(eq + 1).trim();
    if (key) raw[key] = value;
  }

  const rfOhm = toNumber(raw.rf);
  const vccMv = toNumber(raw.vcc);
  const missingForConversion: string[] = [];
  if (rfOhm == null) missingForConversion.push('rf');
  if (vccMv == null) missingForConversion.push('vcc');

  return {
    raw,
    fw: raw.fw ?? null,
    rateHz: toNumber(raw.rate),
    streaming: raw.stream == null ? null : raw.stream === '1' || raw.stream.toLowerCase() === 'true',
    rfOhm,
    vccMv,
    clipMv: toNumber(raw.clip),
    missingForConversion,
  };
}

// ---------------------------------------------------------------------------
// mV -> ohm / microsiemens conversion (verbatim formula from the doc)
// ---------------------------------------------------------------------------

/**
 * R_sensor (ohm) = rf * (vcc - mv) / mv. mv <= 0 means "sensor unloaded" per the doc -> null
 * (treated as open, i.e. infinite resistance), not 0 and not thrown.
 */
export function mvToOhms(mv: number, rfOhm: number, vccMv: number): number | null {
  if (mv <= 0) return null;
  return (rfOhm * (vccMv - mv)) / mv;
}

/** G_sensor (uS) = 1e6 / R_sensor. Open (null) stays null, not 0 or Infinity. */
export function ohmsToMicrosiemens(ohms: number | null): number | null {
  if (ohms == null || ohms <= 0) return null;
  return 1e6 / ohms;
}

/**
 * Converts one decoded sample into physical units using the device's own Info constants.
 * Clipping is true if EITHER the firmware's own flag bit fired OR the raw mV reached
 * info.clipMv (covers an Info read that updates clip after the fact).
 */
export function toReading(sample: KneeSleeveSample, info: KneeSleeveInfo): KneeSleeveReading {
  const canConvert = info.rfOhm != null && info.vccMv != null;
  const ohmsA = canConvert ? mvToOhms(sample.mvA, info.rfOhm as number, info.vccMv as number) : null;
  const ohmsB = canConvert ? mvToOhms(sample.mvB, info.rfOhm as number, info.vccMv as number) : null;
  const clipMv = info.clipMv;
  return {
    ohmsA,
    microsiemensA: ohmsToMicrosiemens(ohmsA),
    ohmsB,
    microsiemensB: ohmsToMicrosiemens(ohmsB),
    clippedA: sample.clippedA || (clipMv != null && sample.mvA >= clipMv),
    clippedB: sample.clippedB || (clipMv != null && sample.mvB >= clipMv),
  };
}

// ---------------------------------------------------------------------------
// Sequence-gap detection (uint16 wraparound at 65536, per the doc)
// ---------------------------------------------------------------------------

const SEQ_MODULUS = 65536;

/**
 * Number of packets dropped between `previousSeq` and `seq`, wrapping at 65536. Returns 0 for
 * the very first sample of a connection (previousSeq === null — the doc says seq restarts at 0
 * on every new connection, so there is nothing to compare against yet).
 */
export function detectSeqGap(previousSeq: number | null, seq: number): number {
  if (previousSeq == null) return 0;
  const expected = (previousSeq + 1) % SEQ_MODULUS;
  return (seq - expected + SEQ_MODULUS) % SEQ_MODULUS;
}

// ---------------------------------------------------------------------------
// Protocol ambiguities — real open questions for Dan's firmware-writer friend.
// Deliberately NOT guessed at anywhere above; each is handled defensively instead
// (see kneeSleeveSourceShared.ts for how the app works around them today).
// ---------------------------------------------------------------------------
export const PROTOCOL_AMBIGUITIES: string[] = [
  'The advertised name is a fixed "KneeSleeve" with no per-device suffix, and neither the ' +
    'Data packet nor the Info string carries a left/right (or any device) identifier. If two ' +
    'physical braces exist, the app cannot tell them apart by name or by packet content — only ' +
    'by BLE device ID, which the app remembers per side after the user manually assigns ' +
    '"Connect left" / "Connect right" the first time. Is a side/ID field planned for a future ' +
    'firmware revision, or is per-device identity intentionally left to the app?',
  'mv_a and mv_b are two independent sensor channels on ONE device. For a single physical ' +
    'brace, do A and B represent two positions on the same knee (e.g. medial/lateral) that ' +
    'should both be shown, or is one of them the "primary" signal and the other a spare/future ' +
    'channel? The app currently treats both as equally real and plots both.',
  'The Info string\'s `clip` value (example: 2500) looks like it should match the firmware\'s ' +
    'own clip flag (bit0/bit1), but nothing enforces that. If a future firmware changes the ' +
    'clip threshold without updating the flag logic, which should the app trust — the flag bit ' +
    'or the mV comparison against `clip`? The app currently treats either one firing as clipped.',
  'batt_mv = 0 is documented as "no battery monitor fitted" rather than "battery dead". Should ' +
    'the app surface these as different UI states ("no battery sensor" vs "battery low"), or is ' +
    'that distinction not useful day to day?',
  'On reconnect, seq restarts at 0 — but the app only knows a reconnect happened via the BLE ' +
    'stack\'s own disconnect/connect events, not from the data stream itself (a huge seq jump ' +
    'is otherwise indistinguishable from ~65536 genuinely dropped packets). Is that assumption ' +
    'safe, or can the device silently reconnect without the phone OS surfacing a disconnect?',
  'rate=50 in the Info example implies ~50 samples/sec per channel per device. With two ' +
    'devices (eventually) that is up to 200 notifications/sec total. Is there a known MTU/' +
    'throughput ceiling on the ESP32-C3 BLE stack if the phone also runs a scan in the ' +
    'background (e.g. searching for the second device while the first streams)?',
];
