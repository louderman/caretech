/**
 * Web adapter (Metro resolves `sensorSource.web.ts` over `sensorSource.ts` on the web target).
 * A Web Bluetooth stub — intentionally unimplemented until the ESP32 firmware and GATT
 * characteristic layout exist. Carried over from the old CareTech-Web sensors.js
 * WebBluetoothSource, re-typed for RN. Shared pieces live in `sensorSourceShared.ts`.
 */

import type { SensorSource, SampleListener, StatusListener, SensorStatus, SensorSide } from './sensorSourceShared';
import { SimulatedSource, createSimulatedSource } from './sensorSourceShared';

export { SimulatedSource };
export type { SensorSource, SampleListener, StatusListener, SensorStatus, SensorSide };

/**
 * Stubbed Web Bluetooth source. Left disconnected from the UI on purpose: the ESP32 firmware and
 * GATT characteristic layout do not exist yet, so none of the TODOs below can be filled in.
 *
 * When the hardware is ready:
 *  TODO: define the GATT service/characteristic UUIDs for left + right brace.
 *  TODO: call navigator.bluetooth.requestDevice({ filters: [...], optionalServices: [...] }).
 *  TODO: connect GATT server, getPrimaryService, getCharacteristic, startNotifications.
 *  TODO: parse the characteristic's DataView into (side, value, timestamp) and call onSample.
 *  TODO: handle reconnect-on-drop and surface onStatus('disconnected') to the UI.
 */
export class WebBluetoothSource implements SensorSource {
  readonly label = 'Bluetooth brace (not available yet)';

  static get isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
  }

  async connect(_onSample: SampleListener, onStatus?: StatusListener): Promise<void> {
    onStatus?.('unavailable');
    throw new Error(
      'No Bluetooth protocol is defined yet — hardware/firmware is not ready. ' +
        'Implement WebBluetoothSource once the ESP32 GATT spec exists.',
    );
  }

  async disconnect(): Promise<void> {
    // Nothing to tear down; connect() never succeeds yet.
  }
}

export function createDefaultSource(): SensorSource {
  return createSimulatedSource();
}
