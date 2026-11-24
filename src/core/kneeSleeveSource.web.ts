/**
 * Web adapter — Web Bluetooth. Picked up by Metro/webpack automatically for the web build in
 * place of kneeSleeveSource.ts (same override pattern as sensorSource.web.ts).
 *
 * Receive only: requestDevice + connect + readValue + startNotifications. No writeValue call
 * anywhere in this file.
 *
 * Web Bluetooth requires a user gesture for requestDevice() and only Chromium-based browsers
 * support it (no Safari/Firefox) — this is a secondary target; the real device test happens on
 * the Android phone build (kneeSleeveSource.ts).
 */
import {
  SERVICE_UUID,
  DATA_CHARACTERISTIC_UUID,
  INFO_CHARACTERISTIC_UUID,
  decodeDataPacket,
  detectSeqGap,
  parseInfoString,
  toReading,
} from './kneeSleeveProtocol';
import {
  getRememberedDeviceId,
  rememberDeviceId,
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

interface SideConnection {
  device: BluetoothDevice;
  dataChar: BluetoothRemoteGATTCharacteristic;
  onChanged: (ev: Event) => void;
  onDisconnected: () => void;
}

export class WebKneeSleeveSource implements KneeSleeveSource {
  readonly label = 'KneeSleeve (Web Bluetooth)';
  private connections = new Map<KneeSleeveSide, SideConnection>();
  private prevSeq = new Map<KneeSleeveSide, number | null>();
  private counts = new Map<KneeSleeveSide, { received: number; dropped: number }>();

  async connect(side: KneeSleeveSide, onSample: KneeSleeveSampleListener, onStatus: KneeSleeveStatusListener): Promise<void> {
    await this.disconnect(side);
    this.prevSeq.set(side, null);
    this.counts.set(side, { received: 0, dropped: 0 });

    const bluetooth = (navigator as any).bluetooth;
    if (!bluetooth) {
      onStatus({ side, state: 'unavailable', packetsReceived: 0, packetsDropped: 0, lastError: 'Web Bluetooth not available in this browser' });
      throw new Error('Web Bluetooth not available in this browser');
    }

    onStatus({ side, state: 'scanning', packetsReceived: 0, packetsDropped: 0 });

    const otherSide: KneeSleeveSide = side === 'L' ? 'R' : 'L';
    const excludeId = this.connections.get(otherSide)?.device.id ?? null;
    const rememberedId = await getRememberedDeviceId(side);

    let device: BluetoothDevice | null = null;
    // getDevices() (previously-granted devices, no picker) is Chrome-only and behind a flag in
    // some versions — feature-detect and fall back to the picker on any failure.
    if (rememberedId && rememberedId !== excludeId && typeof bluetooth.getDevices === 'function') {
      try {
        const known: BluetoothDevice[] = await bluetooth.getDevices();
        device = known.find((d) => d.id === rememberedId) ?? null;
      } catch {
        device = null;
      }
    }
    if (!device) {
      try {
        device = await bluetooth.requestDevice({
          filters: [{ services: [SERVICE_UUID] }],
          optionalServices: [SERVICE_UUID],
        });
      } catch (err: any) {
        onStatus({ side, state: 'error', packetsReceived: 0, packetsDropped: 0, lastError: String(err?.message ?? err) });
        throw err;
      }
    }
    if (!device || device.id === excludeId) {
      onStatus({ side, state: 'error', packetsReceived: 0, packetsDropped: 0, lastError: 'Selected device is already connected to the other side' });
      throw new Error('Selected device is already connected to the other side');
    }

    onStatus({ side, state: 'connecting', deviceId: device.id, deviceName: device.name, packetsReceived: 0, packetsDropped: 0 });

    let server: BluetoothRemoteGATTServer;
    let service: BluetoothRemoteGATTService;
    let infoChar: BluetoothRemoteGATTCharacteristic;
    let dataChar: BluetoothRemoteGATTCharacteristic;
    try {
      server = await device.gatt!.connect();
      service = await server.getPrimaryService(SERVICE_UUID);
      infoChar = await service.getCharacteristic(INFO_CHARACTERISTIC_UUID);
      dataChar = await service.getCharacteristic(DATA_CHARACTERISTIC_UUID);
    } catch (err: any) {
      onStatus({ side, state: 'error', deviceId: device.id, deviceName: device.name, packetsReceived: 0, packetsDropped: 0, lastError: String(err?.message ?? err) });
      throw err;
    }

    await rememberDeviceId(side, device.id);

    let info;
    try {
      const infoValue = await infoChar.readValue();
      const infoText = new TextDecoder().decode(infoValue);
      info = parseInfoString(infoText);
    } catch (err: any) {
      onStatus({ side, state: 'error', deviceId: device.id, deviceName: device.name, packetsReceived: 0, packetsDropped: 0, lastError: `Could not read Info characteristic: ${String(err?.message ?? err)}` });
      throw err;
    }

    const onDisconnected = () => {
      onStatus({
        side,
        state: 'disconnected',
        deviceId: device!.id,
        deviceName: device!.name,
        packetsReceived: this.counts.get(side)?.received ?? 0,
        packetsDropped: this.counts.get(side)?.dropped ?? 0,
      });
    };
    device.addEventListener('gattserverdisconnected', onDisconnected);

    const onChanged = (ev: Event) => {
      const char = ev.target as BluetoothRemoteGATTCharacteristic;
      const value = char.value;
      if (!value) return;
      const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      const decoded = decodeDataPacket(bytes);
      const now = Date.now();
      const counts = this.counts.get(side) ?? { received: 0, dropped: 0 };
      if (!decoded.ok) {
        onStatus({
          side,
          state: 'connected',
          deviceId: device!.id,
          deviceName: device!.name,
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
        deviceName: device!.name,
        info,
        lastPacketAtMs: now,
        packetsReceived: counts.received,
        packetsDropped: counts.dropped,
      });
    };

    try {
      await dataChar.startNotifications();
    } catch (err: any) {
      onStatus({ side, state: 'error', deviceId: device.id, deviceName: device.name, info, packetsReceived: 0, packetsDropped: 0, lastError: String(err?.message ?? err) });
      throw err;
    }
    dataChar.addEventListener('characteristicvaluechanged', onChanged);

    this.connections.set(side, { device, dataChar, onChanged, onDisconnected });
    onStatus({ side, state: 'connected', deviceId: device.id, deviceName: device.name, info, packetsReceived: 0, packetsDropped: 0 });
  }

  async disconnect(side: KneeSleeveSide): Promise<void> {
    const conn = this.connections.get(side);
    this.connections.delete(side);
    if (!conn) return;
    try {
      conn.dataChar.removeEventListener('characteristicvaluechanged', conn.onChanged);
      await conn.dataChar.stopNotifications();
    } catch {
      // Device may already be gone.
    }
    conn.device.removeEventListener('gattserverdisconnected', conn.onDisconnected);
    try {
      conn.device.gatt?.disconnect();
    } catch {
      // Already disconnected.
    }
  }

  async disconnectAll(): Promise<void> {
    for (const side of ['L', 'R'] as KneeSleeveSide[]) await this.disconnect(side);
  }
}

export function createRealKneeSleeveSource(): KneeSleeveSource {
  return new WebKneeSleeveSource();
}

export function createDefaultKneeSleeveSource(): KneeSleeveSource {
  return createRealKneeSleeveSource();
}
