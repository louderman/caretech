# CareTech-RN

Single React Native (Expo SDK 57, TypeScript) codebase that replaces the
standalone `CareTech-Android` Java app. One codebase runs as:

- an Android app (Expo Go / dev client / EAS build), and
- a static web app, exported via `npx expo export -p web` and published to
  GitHub Pages at `/caretech/`.

It is an **exact port** of native CareTech v1.5 (vc8): layout, colours,
spacing, copy, streak rules and the data model are unchanged. The next pass
(tracked separately) will redesign the home screen into a "Progress story"
layout — this `main` branch exists to stay an exact reference point for that
comparison.

## Screens

- **Journal** — streak card → "Last 7 days" → sessions list → knee asymmetry
  chart → sensor readings (raw counts) → completed card.
- **Record Exercise** — pick one of 4 exercises, start/stop a timer, save a
  session.
- Bottom tabs: `Journal | Record Exercise`, teal underline, light mode only.

## Sensor source

`SensorSource` is a small interface with a `SimulatedSource` default (used in
dev/web and in Jest tests). There is a typed-only native adapter stub and a
Web Bluetooth stub (`.web.ts`) — **no `react-native-ble-plx`, no GATT connects
or writes**. The physical knee brace integration isn't wired up yet; this is
intentional until the hardware is ready.

Storage is `AsyncStorage`. Streak logic is ported from
`CareTech-Android/.../MainActivity.java` and unit-tested with Jest
(ported from `CareTechTests.java`).

## Running it

### Web

```bash
npx expo export -p web
npx serve dist   # or any static file server
```

The production export is served under `/caretech/` (see `app.json`
`baseUrl`) to match the GitHub Pages path. Verified locally: root, favicon
and the JS bundle all return HTTP 200 and the app renders (Journal empty
state, bottom tabs, teal underline) rather than a blank page.

### Android

```bash
npx expo start --localhost
adb reverse tcp:8081 tcp:8081
# open exp://127.0.0.1:8081 in Expo Go on the device
```

### Tests / typecheck

```bash
NODE_ENV=development npm test -- --ci   # 26/26 passing, 6 suites
npx tsc --noEmit                        # clean
```

## CI / deploy

`.github/workflows/deploy.yml` builds the web export (`npx expo export -p web`)
and publishes `dist/` to GitHub Pages on every push to `main` (and via manual
`workflow_dispatch`). It does not touch repo or Pages settings — those are
configured separately in the GitHub UI.

## Visual diff vs native v1.5

Reference screenshot: `docs/reference/native-v1.5-reference.jpg`.
Web port screenshots: `docs/reference/shots/` (390×844, matching the
reference device's aspect ratio). Side-by-side comparison:
`docs/reference/shots/side-by-side-native-vs-web.png`.

| Area | Native v1.5 | RN/Expo port | Diff |
| --- | --- | --- | --- |
| Streak card | Bold teal day count, "Last saved: …", 30-day dot strip | Same layout, same teal (#0F6B5C-ish teal), same strip | No visible diff |
| Last 7 days | 7 day-letter circles, filled teal check on today | Same circles, same check mark style and colour | No visible diff |
| Sessions / Completed cards | Light grey rounded cards, exercise name + timestamp + duration | Same card style, same fields | No visible diff |
| Knee asymmetry chart | Purple %, small scatter chart, "Lower is better" caption, formula footnote | Present only once matched recordings exist (empty state: "no matched recordings yet", matches native's empty-state copy) | No visible diff in empty or populated states |
| Sensor readings | Left/right knee legend dots (teal / orange) | Same legend colours and copy | No visible diff |
| Bottom tabs | `Journal | Record Exercise`, teal underline under active tab | Same | No visible diff |
| Typography / spacing | System sans, consistent card padding/radius | Matched via `src/theme.ts` design tokens | No visible diff |

No functional or visual regressions were found against the native reference
during this port. Remaining open item: on-device Android verification (Expo
Go / ExperienceActivity foreground check) — blocked on a phone being
connected over USB.

## Design tokens

Colours, spacing, radii and the type scale live in one theme file
(`src/theme.ts`) so the next design pass (the "Progress story" redesign) has
a single place to retheme from without touching every screen.
