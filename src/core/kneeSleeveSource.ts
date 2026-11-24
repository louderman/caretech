/**
 * Native (Android/iOS) KneeSleeve adapter — react-native-ble-plx. Metro picks this file up for
 * native targets; kneeSleeveSource.web.ts is picked up for web instead. Shared types/helpers
 * live in kneeSleeveSourceShared.ts.
 *
 * Receive only: this file calls connect/discover/read/monitor and NEVER writes to the Control
 * characteristic or any other characteristic. No STOP/START/RATE command is ever sent.
 */
import { Platform, PermissionsAndroid } from 'react-native';
import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';
import {
  SERVICE_UUID,
  DATA_CHARACTERISTIC_UUID,
  INFO_CHARACTERISTIC_UUID,
  RECOMMENDED_MTU,
  decodeDataPacket,
  detectSeqGap,
  parseInfoString,
  toReading,
} from './kneeSleeveProtocol';
import {
  base64ToUint8Array,
  getRememberedDeviceId,
  rememberDeviceId,
  SimulatedKneeSleeveSource,
  type KneeSleeveSampleListener,
  type KneeSleeveSide,
  type KneeSleeveSource,
  type KneeSleeveStatusListener,
} from './kneeSleeveSourceShared';

export { SimulatedKneeSleeveSource, createSimulatedKneeSleeveSource } from './kneeSleeveSourceShared';
export type {
  KneeSleeveSide,
  KneeSleeveSource,
  KneeSleeveStatus,
  KneeSleeveConnectionState,
  KneeSleeveSampleListener,
  KneeSleeveStatusListener,
} from './kneeSleeveSourceShared';

/**
 * Requests the runtime Bluetooth permissions the doc calls for. Android 12+ (API 31+):
 * BLUETOOTH_SCAN + BLUETOOTH_CONNECT. Android 11 and below: location (scan results were
 * historically gated on it). iOS: handled declaratively via Info.plist / app.json, nothing to
 * request at runtime here.
 */
export async function requestAndroidBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return (
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

const SCAN_TIMEOUT_MS = 15000;
const DIRECT_CONNECT_TIMEOUT_MS = 8000;

/**
 * Real BLE adapter. One BleManager instance serves both sides, since a single phone radio scans
 * for both devices; each side tracks its own Device/Subscription/seq state independently so one
 * side's connect/disconnect never disturbs the other.
 */
export class NativeKneeSleeveSource implements KneeSleeveSource {
  readonly label = 'KneeSleeve (Bluetooth)';
  private manager = new BleManager();
  private devices = new Map<KneeSleeveSide, Device>();
  private dataSubs = new Map<KneeSleeveSide, Subscription>();
  private disconnectSubs = new Map<KneeSleeveSide, Subscription>();
  private prevSeq = new Map<KneeSleeveSide, number | null>();
  private counts = new Map<KneeSleeveSide, { received: number; dropped: number }>();

  async connect(side: KneeSleeveSide, onSample: KneeSleeveSampleListener, onStatus: KneeSleeveStatusListener): Promise<void> {
    await this.disconnect(side);
    this.prevSeq.set(side, null);
    this.counts.set(side, { received: 0, dropped: 0 });

    const permitted = await requestAndroidBlePermissions();
    if (!permitted) {
      onStatus({ side, state: 'error', packetsReceived: 0, packetsDropped: 0, lastError: 'Bluetooth permission denied' });
      throw new Error('Bluetooth permission denied');
    }

    onStatus({ side, state: 'scanning', packetsReceived: 0, packetsDropped: 0 });

    const otherSide: KneeSleeveSide = side === 'L' ? 'R' : 'L';
    const excludeId = this.devices.get(otherSide)?.id ?? null;
    const rememberedId = await getRememberedDeviceId(side);

    let device: Device | null = null;
    if (rememberedId && rememberedId !== excludeId) {
      device = await this.tryDirectConnect(rememberedId).catch(() => null);
    }
    if (!device) {
      device = await this.scanForDevice(excludeId);
    }
    if (!device) {
      onStatus({ side, state: 'error', packetsReceived: 0, packetsDropped: 0, lastError: 'No KneeSleeve device found while scanning' });
      throw new Error('No KneeSleeve device found while scanning');
    }

    onStatus({ side, state: 'connecting', deviceId: device.id, deviceName: device.name ?? undefined, packetsReceived: 0, packetsDropped: 0 });

    try {
      let connected = await device.isConnected();
      if (!connected) {
        connected = false;
        device = await device.connect();
      }
      await device.discoverAllServicesAndCharacteristics();
      try {
        await device.requestMTU(RECOMMENDED_MTU);
      } catch {
        // Best-effort — iOS negotiates its own MTU and some Android stacks reject the request
        // harmlessly. Data still fits the default 20-byte payload per the doc either way.
      }
    } catch (err: any) {
      onStatus({ side, state: 'error', deviceId: device.id, packetsReceived: 0, packetsDropped: 0, lastError: String(err?.message ?? err) });
      throw err;
    }

    this.devices.set(side, device);
    await rememberDeviceId(side, device.id);

    const disconnectSub = this.manager.onDeviceDisconnected(device.id, () => {
      onStatus({
        side,
        state: 'disconnected',
        deviceId: device!.id,
        deviceName: device!.name ?? undefined,
        packetsReceived: this.counts.get(side)?.received ?? 0,
        packetsDropped: this.counts.get(side)?.dropped ?? 0,
      });
    });
    this.disconnectSubs.set(side, disconnectSub);

    let info;
    try {
      const infoChar = await device.readCharacteristicForService(SERVICE_UUID, INFO_CHARACTERISTIC_UUID);
      const infoBytes = base64ToUint8Array(infoChar.value ?? '');
      const infoText = Array.from(infoBytes)
        .map((b) => String.fromCharCode(b))
        .join('');
      info = parseInfoString(infoText);
    } catch (err: any) {
      onStatus({
        side,
        state: 'error',
        deviceId: device.id,
        deviceName: device.name ?? undefined,
        packetsReceived: 0,
        packetsDropped: 0,
        lastError: `Could not read Info characteristic: ${String(err?.message ?? err)}`,
      });
      throw err;
    }

    onStatus({
      side,
      state: 'connected',
      deviceId: device.id,
      deviceName: device.name ?? undefined,
      info,
      packetsReceived: 0,
      packetsDropped: 0,
    });

    const dataSub = device.monitorCharacteristicForService(SERVICE_UUID, DATA_CHARACTERISTIC_UUID, (error, characteristic) => {
      if (error) {
        onStatus({
          side,
          state: 'error',
          deviceId: device!.id,
          deviceName: device!.name ?? undefined,
          info,
          packetsReceived: this.counts.get(side)?.received ?? 0,
          packetsDropped: this.counts.get(side)?.dropped ?? 0,
          lastError: String(error.message ?? error),
        });
        return;
      }
      const bytes = base64ToUint8Array(characteristic?.value ?? '');
      const decoded = decodeDataPacket(bytes);
      const now = Date.now();
      const counts = this.counts.get(side) ?? { received: 0, dropped: 0 };
      if (!decoded.ok) {
        onStatus({
          side,
          state: 'connected',
          deviceId: device!.id,
          deviceName: device!.name ?? undefined,
          info,
          lastPacketAtMs: now,
          packetsReceived: counts.received,
          packetsDropped: counts.dropped,
          lastError: decoded.error,
        });
        return;
      }
      const gap = detectSeqGap(this.prevSeq.get(side) ?? null, decoded.sample.seq);
      this.prevSeq.set(side, decoded.sample.seq);
      counts.received += 1;
      counts.dropped += gap;
      this.counts.set(side, counts);
      const reading = toReading(decoded.sample, info);
      onSample(side, decoded.sample, reading, now);
      onStatus({
        side,
        state: 'connected',
        deviceId: device!.id,
        deviceName: device!.name ?? undefined,
        info,
        lastPacketAtMs: now,
        packetsReceived: counts.received,
        packetsDropped: counts.dropped,
      });
    });
    this.dataSubs.set(side, dataSub);
  }

  private tryDirectConnect(deviceId: string): Promise<Device | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), DIRECT_CONNECT_TIMEOUT_MS);
      this.manager
        .connectToDevice(deviceId, { timeout: DIRECT_CONNECT_TIMEOUT_MS })
        .then((device) => {
          clearTimeout(timer);
          resolve(device);
        })
        .catch(() => {
          clearTimeout(timer);
          resolve(null);
        });
    });
  }

  private scanForDevice(excludeId: string | null): Promise<Device | null> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (device: Device | null) => {
        if (settled) return;
        settled = true;
        this.manager.stopDeviceScan();
        resolve(device);
      };
      const timer = setTimeout(() => finish(null), SCAN_TIMEOUT_MS);
      this.manager.startDeviceScan([SERVICE_UUID], null, (error, device) => {
        if (error) {
          clearTimeout(timer);
          finish(null);
          return;
        }
        if (!device) return;
        if (excludeId && device.id === excludeId) return; // already claimed by the other side
        clearTimeout(timer);
        finish(device);
      });
    });
  }

  async disconnect(side: KneeSleeveSide): Promise<void> {
    this.dataSubs.get(side)?.remove();
    this.dataSubs.delete(side);
    this.disconnectSubs.get(side)?.remove();
    this.disconnectSubs.delete(side);
    const device = this.devices.get(side);
    this.devices.delete(side);
    if (device) {
      try {
        const connected = await device.isConnected();
        if (connected) await device.cancelConnection();
      } catch {
        // Already gone — nothing more to do.
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const side of ['L', 'R'] as KneeSleeveSide[]) await this.disconnect(side);
  }
}

export function createRealKneeSleeveSource(): KneeSleeveSource {
  return new NativeKneeSleeveSource();
}

/** Default export used by the UI: the real adapter on native. Demo mode uses SimulatedKneeSleeveSource directly. */
export function createDefaultKneeSleeveSource(): KneeSleeveSource {
  return createRealKneeSleeveSource();
}
