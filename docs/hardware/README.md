# KneeSleeve: ESP32-C3 SuperMini + 2 × SF15-100

Reads two thin-film force sensors separately and streams both over Bluetooth Low Energy (BLE) and USB serial.

```
KneeSleeve_ESP32C3/
├── platformio.ini        board + build settings (VS Code / PlatformIO)
├── src/main.cpp          firmware
├── docs/BLE_PROTOCOL.md  hand this to whoever builds the mobile app
└── tools/ble_logger.py   laptop BLE test logger (before the app exists)
```

## 1. Wiring (changes from the Uno version)

**Sensors must run from 3V3, not 5V.** ESP32-C3 pins are not 5 V tolerant (3.6 V max). A pressed sensor on 5 V would push nearly 5 V into the pin and can damage it.

```
           ┌──[ SF15-100  A ]──┬──► GPIO0
3V3 ───────┤                   └──[ 10kΩ ]── GND
           └──[ SF15-100  B ]──┬──► GPIO1
                               └──[ 10kΩ ]── GND
```

- Each sensor gets **its own** 10 kΩ resistor and **its own** pin. Only 3V3 and GND are shared.
- GPIO0 and GPIO1 are analog-capable (ADC1). Do not use GPIO2, 8 or 9 (they affect how the board starts up), and avoid GPIO5 (ADC2, unreliable when Bluetooth is on). GPIO3 and GPIO4 are the spare analog pins.
- Optional: a 100 nF capacitor from each sensor pin to GND reduces noise.
- The C3 only reads accurately up to about 2.5 V. With 10 kΩ, that is reached when a sensor drops below about 3.2 kΩ (a firm press). The firmware flags this as "clipped". If it happens during normal wear, use a smaller resistor, then update `R_FIXED_OHM`.

### Power (the SuperMini has no battery charger)

```
LiPo + ──► [TP4056 charger w/ protection] OUT+ ──► [slide switch] ──► SuperMini 5V pin
LiPo − ──► TP4056 B−                     OUT− ─────────────────────► SuperMini GND
```

- **Never connect the LiPo to the 3V3 pin.** A full cell is 4.2 V.
- Feeding the **5V pin** works because the board's 3.3 V regulator has a small dropout. Readings stay stable down to about 3.5 V of battery voltage.
- Use a TP4056 module **with** protection (the version with DW01/8205 chips, usually marked "with protection" or with OUT+/OUT− pads) for charging and over-discharge cutoff.
- **Switch the battery off before plugging in USB** unless you have confirmed your SuperMini has a diode between USB and the 5V pin. Otherwise USB 5 V can back-feed into the battery circuit.
- Optional battery monitor: battery + (after the switch) ──100k──┬──► GPIO3, and ──100k── GND from the same point. Then set `PIN_BATTERY = 3` in `main.cpp`.
- Power savers: set `SERIAL_STREAM = false` when running on battery. The SuperMini's always-on red power LED draws a few mA and can be desoldered on the worn unit.

## 2. VS Code setup (first time)

1. Install **VS Code**, then the **PlatformIO IDE** extension (Extensions panel → search "PlatformIO IDE"). Restart VS Code when prompted.
2. **File → Open Folder…** and choose `KneeSleeve_ESP32C3` (the folder that contains `platformio.ini`).
3. Click **✓ Build** in the blue bottom bar. The first build downloads the ESP32 toolchain (a few minutes, needs internet).
4. Plug in the SuperMini with a USB-C **data** cable (some cables are charge-only and the board won't show up).
5. Click **→ Upload**.
   - If upload fails with "No serial data received" or the port doesn't appear: hold **BOOT**, tap **RST**, release BOOT, then upload again. Press **RST** afterwards to run the new code. This is normal on SuperMini boards, usually only for the first flash.
6. Click the **plug icon (Serial Monitor)**. You'll see:
   ```
   t_ms,seq,mv_a,mv_b,G_a_uS,G_b_uS,batt_mv,flags
   12034,42,0,0,0.00,0.00,0,0
   ```
   Type `INFO` + Enter to reprint the header and settings.

## 3. Check the two sensors read separately

| Test | Expected |
|---|---|
| Nothing touching either sensor | `mv_a` and `mv_b` near 0 |
| Squeeze sensor A only | `mv_a` rises (hundreds to 2000+ mV), `mv_b` stays near 0 |
| Squeeze sensor B only | the opposite |
| A reading stuck high with nothing pressing | that sensor's 10 kΩ isn't connected to GND |
| Squeezing A also moves B | wiring is shared somewhere it shouldn't be. Each sensor needs its own resistor and pin |
| A and B swapped | swap the wires, or swap `PIN_SENSOR_A` / `PIN_SENSOR_B` |

Then put the sleeve on and bend the knee slowly while watching both columns.

## 4. Test Bluetooth before the app exists

**Phone:** install **nRF Connect** (Android / iOS) → Scan → `KneeSleeve` → Connect → open the service startin g `8f1d0001` → tap the notify (↓↓↓) icon on characteristic `8f1d0002`. Hex packets stream in. Packet layout is in `docs/BLE_PROTOCOL.md`.

**Laptop (records a CSV):**
```
pip install bleak
python tools/ble_logger.py --seconds 60 --out walk_test.csv
```
It prints live A/B values and reports any dropped packets. Close nRF Connect first, because only one device can be connected at a time.

## 5. Mobile app

Give the app developer `docs/BLE_PROTOCOL.md`. It has the UUIDs, packet format, commands, permission requirements and parsing code for Flutter, React Native and Python.

## Commands (serial monitor or BLE control characteristic)

`START` · `STOP` · `RATE <1-100>` · `INFO`
