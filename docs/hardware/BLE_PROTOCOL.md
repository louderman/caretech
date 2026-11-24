# KneeSleeve BLE protocol (firmware 1.0)

For whoever builds the mobile app. The ESP32-C3 only supports Bluetooth Low Energy (no Classic Bluetooth / SPP), which is also what iOS requires for custom devices. The device is a standard **BLE GATT peripheral**: the phone scans, connects, subscribes to notifications and receives packets.

## Finding the device

- Advertised name: `KneeSleeve`
- Advertised service UUID: `8f1d0001-6b2e-4c3a-9a5e-2f0c1d4b7a10`
- Scan by service UUID, not MAC address: iOS never exposes MAC addresses, and filtering by service is more reliable on both platforms.

## Service and characteristics

| Characteristic | UUID | Properties | Contents |
|---|---|---|---|
| Data | `8f1d0002-6b2e-4c3a-9a5e-2f0c1d4b7a10` | Notify | 13-byte binary sample packet (below) |
| Control | `8f1d0003-6b2e-4c3a-9a5e-2f0c1d4b7a10` | Write, Write without response | ASCII command |
| Info | `8f1d0004-6b2e-4c3a-9a5e-2f0c1d4b7a10` | Read, Notify | ASCII settings string |

## Data packet (13 bytes, little-endian)

| Offset | Type | Field | Meaning |
|---|---|---|---|
| 0 | uint16 | `seq` | Sample counter, resets to 0 on each new connection. A gap means packets were dropped. Wraps at 65535. |
| 2 | uint32 | `t_ms` | Device milliseconds since boot (sample timestamp) |
| 6 | uint16 | `mv_a` | Sensor A divider voltage, mV |
| 8 | uint16 | `mv_b` | Sensor B divider voltage, mV |
| 10 | uint16 | `batt_mv` | Battery voltage, mV (0 = no battery monitor fitted) |
| 12 | uint8 | `flags` | bit0 = sensor A clipped, bit1 = sensor B clipped, bit2 = low battery |

One packet per sample, at 50 Hz by default. The packet fits the default 20-byte BLE payload, so no MTU negotiation is needed for data.

### Converting to sensor resistance / conductance

Constants come from the Info string (`rf`, `vcc`):

```
R_sensor (ohm) = rf * (vcc - mv) / mv          (mv = 0  -> sensor unloaded, treat as open)
G_sensor (uS)  = 1e6 / R_sensor                (grows roughly in proportion to force)
```

Readings at or above `clip` mV (flag bit set) are saturated and not trustworthy.

## Control commands (write ASCII, case-insensitive)

| Command | Effect |
|---|---|
| `START` | Start streaming (default on every new connection) |
| `STOP` | Stop streaming (device stays connected) |
| `RATE <n>` | Sample rate, 1-100 Hz |
| `INFO` | Re-publish the Info string |

After every valid command the Info characteristic updates (and notifies if subscribed).

## Info string

Example: `fw=1.0;rate=50;stream=1;rf=10000;vcc=3300;clip=2500`

Semicolon-separated `key=value`. Read it after connecting and store it with the session, so the raw data can always be converted later. Reading works at any MTU. To receive it as a *notification* on Android, request a larger MTU first (e.g. `requestMtu(185)`); iOS negotiates this automatically.

## Recommended app flow

1. Request Bluetooth permissions. Android 12+: `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT`. Android 11 and below: location permission. iOS: `NSBluetoothAlwaysUsageDescription` in Info.plist.
2. Scan with a filter for the service UUID, then connect.
3. (Android) request MTU 185.
4. Read **Info** and save it with the recording.
5. Subscribe to **Data** notifications. Packets start arriving right away.
6. Log every packet, plus the **phone's own receive timestamp** (device `t_ms` is time since boot, not wall-clock time).
7. Use `seq` to detect dropped packets. Keep them in the log as gaps rather than interpolating silently.
8. On disconnect, reconnect automatically. `seq` restarts at 0 for the new session.

## Parsing examples

**Dart (Flutter, e.g. flutter_blue_plus)**

```dart
final bd = ByteData.sublistView(Uint8List.fromList(value));
final seq   = bd.getUint16(0, Endian.little);
final tMs   = bd.getUint32(2, Endian.little);
final mvA   = bd.getUint16(6, Endian.little);
final mvB   = bd.getUint16(8, Endian.little);
final batt  = bd.getUint16(10, Endian.little);
final flags = bd.getUint8(12);
```

**JavaScript (React Native, e.g. react-native-ble-plx: value arrives base64)**

```js
const b = Buffer.from(base64Value, 'base64');
const seq = b.readUInt16LE(0), tMs = b.readUInt32LE(2);
const mvA = b.readUInt16LE(6), mvB = b.readUInt16LE(8);
const batt = b.readUInt16LE(10), flags = b.readUInt8(12);
```

**Python (bleak)**

```python
seq, t_ms, mv_a, mv_b, batt_mv, flags = struct.unpack("<HIHHHB", data)
```
