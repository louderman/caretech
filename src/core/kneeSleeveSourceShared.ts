/**
 * Shared KneeSleeve BLE pieces usable from both the native adapter (kneeSleeveSource.ts) and the
 * web adapter (kneeSleeveSource.web.ts) — same split as sensorSource.ts/.web.ts/Shared.ts.
 * Kept in a file with a different basename than either platform file for the same reason noted
 * there: a relative import of './kneeSleeveSource' from inside kneeSleeveSource.web.ts would
 * resolve back to itself under Metro's platform-extension resolution.
 *
 * This is the RECEIVE-ONLY real-hardware path (KneeSleeve ESP32-C3), separate from the existing
 * simulated-only SensorSource used by ExerciseScreen's session recorder. The two are intentionally
 * not merged: ExerciseScreen's SimulatedSource emits one scalar per side for the session timer,
 * while this models a real BLE GATT connection per side with two physical sensor channels (A/B),
 * connection status, and drop counts — see docs/hardware/BLE_PROTOCOL.md.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  decodeDataPacket,
  detectSeqGap,
  encodeDataPacketForTest,
  parseInfoString,
  toReading,
  type KneeSleeveInfo,
  type KneeSleeveReading,
  type KneeSleeveSample,
} from './kneeSleeveProtocol';

export type KneeSleeveSide = 'L' | 'R';
export const SIDES: KneeSleeveSide[] = ['L', 'R'];

export type KneeSleeveConnectionState =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'unavailable';

export interface KneeSleeveStatus {
  side: KneeSleeveSide;
  state: KneeSleeveConnectionState;
  deviceId?: string;
  deviceName?: string;
  info?: KneeSleeveInfo;
  lastPacketAtMs?: number;
  packetsReceived: number;
  packetsDropped: number;
  lastError?: string;
}

export function initialStatus(side: KneeSleeveSide): KneeSleeveStatus {
  return { side, state: 'idle', packetsReceived: 0, packetsDropped: 0 };
}

export type KneeSleeveSampleListener = (
  side: KneeSleeveSide,
  sample: KneeSleeveSample,
  reading: KneeSleeveReading,
  receivedAtMs: number,
) => void;
export type KneeSleeveStatusListener = (status: KneeSleeveStatus) => void;

/** One real (or simulated) BLE source, able to manage both sides' connections independently. */
export interface KneeSleeveSource {
  readonly label: string;
  connect(side: KneeSleeveSide, onSample: KneeSleeveSampleListener, onStatus: KneeSleeveStatusListener): Promise<void>;
  disconnect(side: KneeSleeveSide): Promise<void>;
  disconnectAll(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Remembered device ID per side (AsyncStorage) — see kneeSleeveProtocol.ts
// PROTOCOL_AMBIGUITIES #1: the firmware has no side identifier, so the app remembers which
// physical device ID the user assigned to each side the first time they connected it.
// ---------------------------------------------------------------------------
const STORAGE_PREFIX = 'caretech.kneesleeve.deviceId.';

export async function getRememberedDeviceId(side: KneeSleeveSide): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_PREFIX + side);
  } catch {
    return null;
  }
}

export async function rememberDeviceId(side: KneeSleeveSide, deviceId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_PREFIX + side, deviceId);
  } catch {
    // Best-effort; a failed write just means the next connect scans again instead of reconnecting directly.
  }
}

export async function forgetDeviceId(side: KneeSleeveSide): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_PREFIX + side);
  } catch {
    // Ignored — see rememberDeviceId.
  }
}

// ---------------------------------------------------------------------------
// Base64 <-> bytes, for native adapters whose BLE library hands back base64 characteristic
// values. Implemented locally (no extra dependency) since RN has no built-in atob/Buffer.
// ---------------------------------------------------------------------------
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE64_CHARS.indexOf(clean[i]);
    if (idx < 0) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

// ---------------------------------------------------------------------------
// Simulated source — demo mode for both platforms, no hardware required. Produces plausible
// two-channel data through the SAME decode/convert path real packets use, so the UI code under
// test is identical whether the bytes came from BLE or from this generator.
// ---------------------------------------------------------------------------
const DEMO_INFO: KneeSleeveInfo = parseInfoString('fw=demo;rate=20;stream=1;rf=10000;vcc=3300;clip=2500');

class SimulatedSideConnection {
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;
  private prevSeq: number | null = null;
  private t0 = 0;
  private baseA = 400 + Math.random() * 300;
  private baseB = 400 + Math.random() * 300;

  start(side: KneeSleeveSide, onSample: KneeSleeveSampleListener, onStatus: KneeSleeveStatusListener): void {
    this.t0 = Date.now();
    onStatus({
      side,
      state: 'connected',
      deviceId: `simulated-${side}`,
      deviceName: `KneeSleeve (demo ${side})`,
      info: DEMO_INFO,
      packetsReceived: 0,
      packetsDropped: 0,
      lastPacketAtMs: Date.now(),
    });
    let received = 0;
    let dropped = 0;
    this.timer = setInterval(() => {
      const tSec = (Date.now() - this.t0) / 1000;
      // Occasionally skip a seq number so the UI's drop counter has something real to show.
      const skip = Math.random() < 0.03;
      this.seq = (this.seq + (skip ? 2 : 1)) % 65536;
      const mvA = Math.max(0, Math.round(this.baseA + 220 * Math.max(0, Math.sin(tSec * 1.1)) + (Math.random() - 0.5) * 20));
      const mvB = Math.max(0, Math.round(this.baseB + 220 * Math.max(0, Math.sin(tSec * 1.1 + 0.9)) + (Math.random() - 0.5) * 20));
      const bytes = encodeDataPacketForTest({
        seq: this.seq,
        tMs: Date.now() - this.t0,
        mvA,
        mvB,
        battMv: 4050,
        flags: 0,
      });
      const decoded = decodeDataPacket(bytes);
      if (!decoded.ok) return; // unreachable — this generator always produces 13 bytes.
      const gap = detectSeqGap(this.prevSeq, decoded.sample.seq);
      this.prevSeq = decoded.sample.seq;
      dropped += gap;
      received += 1;
      const reading = toReading(decoded.sample, DEMO_INFO);
      const now = Date.now();
      onSample(side, decoded.sample, reading, now);
      onStatus({
        side,
        state: 'connected',
        deviceId: `simulated-${side}`,
        deviceName: `KneeSleeve (demo ${side})`,
        info: DEMO_INFO,
        lastPacketAtMs: now,
        packetsReceived: received,
        packetsDropped: dropped,
      });
    }, 1000 / 20); // 20 Hz — plenty for a demo graph, lighter on React re-renders than the real 50 Hz.
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/** Demo-mode source: two independently-animated simulated devices, keyed by side. No BLE at all. */
export class SimulatedKneeSleeveSource implements KneeSleeveSource {
  readonly label = 'Simulated KneeSleeve (demo mode)';
  private connections = new Map<KneeSleeveSide, SimulatedSideConnection>();

  async connect(side: KneeSleeveSide, onSample: KneeSleeveSampleListener, onStatus: KneeSleeveStatusListener): Promise<void> {
    await this.disconnect(side);
    const conn = new SimulatedSideConnection();
    this.connections.set(side, conn);
    conn.start(side, onSample, onStatus);
  }

  async disconnect(side: KneeSleeveSide): Promise<void> {
    this.connections.get(side)?.stop();
    this.connections.delete(side);
  }

  async disconnectAll(): Promise<void> {
    for (const side of SIDES) await this.disconnect(side);
  }
}

export function createSimulatedKneeSleeveSource(): KneeSleeveSource {
  return new SimulatedKneeSleeveSource();
}
