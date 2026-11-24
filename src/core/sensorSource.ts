/**
 * SensorSource: the adapter contract every brace data source implements. Hardware doesn't exist
 * yet (the knee brace isn't ready), so only SimulatedSource is wired into the UI. No real BLE
 * protocol is implemented anywhere in this build — no react-native-ble-plx, no GATT
 * connects/writes.
 *
 * This file is Metro's native (Android/iOS) resolution; `sensorSource.web.ts` is picked up for
 * the web target instead. Shared pieces live in `sensorSourceShared.ts` so neither platform file
 * ever imports a sibling of its own basename (that would resolve back to itself).
 */

import type { SensorSource, SampleListener, StatusListener, SensorStatus, SensorSide } from './sensorSourceShared';
import { SimulatedSource, createSimulatedSource } from './sensorSourceShared';

export { SimulatedSource };
export type { SensorSource, SampleListener, StatusListener, SensorStatus, SensorSide };

/**
 * Native (Android/iOS) adapter: a typed stub only. No BLE library is linked and no brace
 * protocol exists, so connect() always rejects.
 */
export class NativeBraceSource implements SensorSource {
  readonly label = 'Bluetooth brace (not available yet)';

  async connect(_onSample: SampleListener, onStatus?: StatusListener): Promise<void> {
    onStatus?.('unavailable');
    throw new Error(
      'No brace BLE protocol is defined yet — hardware/firmware is not ready. ' +
        'This build intentionally has no react-native-ble-plx dependency and makes no GATT ' +
        'connects or writes.',
    );
  }

  async disconnect(): Promise<void> {
    // Nothing to tear down; connect() never succeeds yet.
  }
}

export function createDefaultSource(): SensorSource {
  return createSimulatedSource();
}
