# CareTech v1.5 (vc8) — native port contract

Audit of the authoritative native Android source so the RN/Expo port can be
checked against it line-for-line. Source of truth: `/home/dan/Documents/CareTech-Android`
(package `com.caretech.tracker`, `AndroidManifest.xml` → `versionCode="8"`,
`versionName="1.5"`). Neither that project nor `/home/dan/Documents/CareTech-Web`
was modified while producing this document.

**Note on this document's place in the timeline:** by the time this audit was
written, task `t_750bc157` (parent of this card) had already built, tested and
pushed a working RN/Expo port of this exact spec — see `/home/dan/Documents/CareTech-RN`
git history (`eec106e` → `6b8702f`) and its README. This document is the
retrospective, line-level contract that port should be checked against (and
that any future rework of it must keep matching), not a greenfield spec for
a port that doesn't exist yet.

## 1. App shell (`MainActivity`)

Single activity, persistent two-tab bar pinned to the bottom of the screen:
`Journal` (default) and `Record Exercise`, each a column of label text over a
3dp underline bar. Active tab: `PRIMARY` label colour + bold + `PRIMARY`
underline. Inactive tab: `MUTED` label colour + normal weight + transparent
underline. Tab bar sits below a 1dp `DIVIDER` line, with 8dp horizontal / 6dp
vertical padding (bottom padding adds the device's bottom safe-area inset).
Content area re-renders in full (`render()`) on: tab switch, `onResume`,
app-level date/time broadcast (`ACTION_DATE_CHANGED`/`TIME_CHANGED`/
`TIMEZONE_CHANGED`/`TIME_TICK`), and a 15s poll that detects a local-day
rollover while the activity is foregrounded.

A second activity, `ExerciseActivity`, is pushed for one specific exercise's
timer/history screen and returns to `MainActivity` via its own "Back to
Journal" button (not the OS back stack semantics — it clears the activity
stack and passes which saved row to highlight).

### 1.1 Journal tab — exact card order

`buildJournal()` assembles, top to bottom, only the pieces that have
something to show:

1. **Debug banner** — only when launched with the `caretech_fixture` intent
   extra (see §7). Never present in normal use.
2. **First-use CTA** — only when *no* exercise has *ever* had a finished,
   saved session (checked across all 4 exercise keys). Disappears forever
   once any session is saved.
3. **Streak card** — only when at least one session has ever been saved.
4. **"Last 7 days" card** — rendered together with the streak card (same
   gate: saved sessions non-empty).
5. **Knee asymmetry card** — only when at least one recorded session has a
   comparable (non-NaN) asymmetry value.
6. **Sensor readings card** — only when at least one recorded session has a
   non-NaN left or right mean reading.
7. **Sessions card** — always rendered (shows its own "No sessions recorded
   yet." empty state inside the card when empty).
8. **Empty-chart fallback rows** — one plain text row for asymmetry and/or
   one for sensor readings, each only when step 5/6 did *not* render that
   card. Never both the card and its fallback row at once.
9. **Completed card** — always rendered, always last.

Order is fixed; nothing reorders based on data except whether optional cards
8/5/6 are present at all.

### 1.2 Record Exercise tab

`buildRecord()`: a `"Exercises"` section label, then one tappable row per
entry in `Exercises.NAMES`/`KEYS` (always all 4, in the fixed array order:
Sit to Stand, Timed Up and Go, Walk, Stair Climb), then a `"Brace"` section
label and one static informational card. No data-dependent branching here at
all — this screen looks identical on every launch.

### 1.3 Exercise screen (`ExerciseActivity`)

Order: exercise name (header) → hint line → ROM caveat caption → saved-session
receipt card (hidden until a session is saved) → "Back to Journal" button
(hidden until a session is saved) → big elapsed-time readout → status line →
Start/Finish button row → `"Your sessions for {name, lowercased}"` header →
up to 10 most-recent session rows (newest first) → disclaimer line.

State machine: `Ready` → tap Start → `Timing …` (elapsed ticks every 200ms via
`SystemClock.elapsedRealtime()`, immune to wall-clock changes) → tap Finish →
`Finished`, receipt card becomes visible with `"Session saved"`, "Back to
Journal" becomes visible, the session is written to `SessionStore` at this
exact moment (not at Start), and the exercise's own history list refreshes.
Finish is disabled while not running; Start is disabled while running
(0.45 alpha on whichever is disabled).

## 2. Visible copy — verbatim strings

Copy must port byte-identical (these are the exact literals in source, not
paraphrases):

**Tabs:** `Journal` · `Record Exercise`

**Debug banner:** `Debug preview — synthetic fixture. Not real recordings, never saved.`

**Streak card:** `{n}` (number) · `day streak` · `Last saved: today, HH:mm` (today) or `Last saved: d MMM` (not today, format `d MMM`, e.g. `2 Apr`) · `Last 30 days`

**Last 7 days card title:** `Last 7 days`

**First-use CTA:** `Record your first exercise` · `Pick one of 4 exercises and start a timer — no setup needed.`

**Empty-chart fallback rows** (template `"{title} — {status}."`):
- `Knee asymmetry — no matched recordings yet.`
- `Sensor readings — no brace recordings yet.`

**Knee asymmetry card:** title `Knee asymmetry (%)` · hero value `{x.x}%` or `—` when unavailable · `Lower is better` · primary line `How evenly the two knees are loaded, from matched recordings only.` · detail line `Formula: 100 × |left − right| ÷ average. Shown only when both knees have a recording from the same session; other sessions are gaps.` · in-chart empty text (only reachable in theory — see §9.4) `No comparable pair`

**Sensor readings card:** title `Sensor readings (raw counts)` · legend labels `Left knee` / `Right knee` · legend key line `Solid line with round points: left knee. Dashed line with square points: right knee.` · primary line `Each knee's average raw sensor reading per session — not a measurement of force or resistance.` · detail line `Raw 12-bit ADC counts from the brace sensor. A knee with no recording that session is a gap, never zero.` · in-chart empty text `No brace recordings`

**Sessions card:** title `Sessions` · empty `No sessions recorded yet.` · overflow `Showing the {shown} most recent of {total} sessions.` (cap: 12 rows shown)

**Completed card:** title `Completed` · per-row status `done` / `not yet` (no date header)

**Record Exercise tab:** section labels `Exercises` / `Brace` · brace card primary `Brace recording isn't connected. You can still time and save exercises.` · brace card detail `Brace recordings can only be added from a documented replay file.`

**Exercise names** (`Exercises.NAMES`, fixed order): `Sit to Stand` · `Timed Up and Go` · `Walk` · `Stair Climb`
**Exercise hints** (`Exercises.HINTS`, same order): `Stand up from a chair, then sit back down.` · `Stand, walk a short distance, turn around and return to the chair.` · `Walk at your usual pace.` · `Go up and down a flight of stairs.`

**Exercise screen:** ROM caveat `Range of motion shows only if a calibrated angle record exists for this session.` · receipt heading `Session saved` · receipt detail template `Exercise: {name}\nDate: {date}\nDuration: {duration}\n{romLine}` · romLine `Range of motion: unavailable (no calibrated angle record)` or `Range of motion: left {x.x deg|unavailable}, right {x.x deg|unavailable}` · "Back to Journal" label and a11y description `Back to Journal. Shows the session that was just saved.` · elapsed initial `0:00` · status `Ready` → `Timing …` → `Finished` · buttons `Start` / `Finish` · history header `Your sessions for {name.toLowerCase()}` · history empty `No sessions recorded yet.` · history overflow `Showing the 10 most recent sessions.` · disclaimer `Time alone is a personal record, not a score — a longer session can mean more repetitions or a steadier pace.`

**App name** (`strings.xml`): `CareTech`

Date formats actually used: `EEE d MMM yyyy, HH:mm` (exercise-screen session rows), `d MMM, HH:mm` (Journal session rows), `yyyy-MM-dd` (internal day-rollover key, not shown), `EEEEE` (single weekday-initial letter, Last-7-days marks), `EEEE, d MMM` (accessibility description only). Duration format: `H:MM:SS` once ≥1 hour, else `M:SS` (e.g. `12:34`, `1:02:03`).

## 3. Measured colours (hex, from `MainActivity.java` constants)

| token | hex | use |
| --- | --- | --- |
| `BG` | `#FFFFFF` | screen/card-less background |
| `INK` | `#17212B` | primary text |
| `MUTED` | `#5A6470` | secondary text, inactive tab, axis ticks |
| `PRIMARY` | `#1F6F6B` | teal accent: active tab, streak number, buttons, done marks |
| `CARD` | `#F1F5F5` | bounded-card fill |
| `DIVIDER` | `#E3E8E8` | hairline borders, missed-day marks, chart axis frame colour source (see note) |
| `SUCCESS` | `#1B7F4B` | saved-session receipt heading/accent |
| `HIGHLIGHT` | `#EAF4F2` | one-time tint for the just-saved session row |
| `SENSOR_LEFT` | `#1F6F6B` | left-knee series (same hex as `PRIMARY`, intentional) |
| `SENSOR_RIGHT` | `#B4601A` | right-knee series |
| `ASYMMETRY` | `#6B3FA0` | asymmetry series/value |
| debug banner text | `#7A3E00` | fixture banner only |
| debug banner bg | `#FFF1D6` | fixture banner only |
| debug banner border | `#E0B172` | fixture banner only |
| chart axis frame | `#B9C2C6` | `LineChartView.AXIS`, distinct from `DIVIDER` — not reused from `MainActivity` |
| chart tick/empty text | `#5A6470` | `LineChartView.TICK`/`EMPTY`, same hex as `MUTED` |

These match the values already in this repo's `src/theme.ts` and the earlier
`t_ae69a023` handoff — confirmed independently against the source here, not
copied forward unverified.

## 4. Dimensions & spacing (dp/sp, from `MainActivity`/`ExerciseActivity`)

- Screen padding: 20dp left/right, 28dp bottom, top = `max(20dp, statusBarInset + 8dp)`.
- Card surface (`surface()`): 16dp corner radius, 1dp `DIVIDER` border, 16dp padding all sides, `CARD` fill. Card title 17sp bold `INK`, 10dp bottom margin under it.
- Card vertical gap: 24dp standard, 22dp when neither chart card has data (the fallback rows use 22dp then 6dp between the two fallback rows if both are shown).
- First-use CTA: 14dp corner radius, 2dp `PRIMARY` border, `BG` fill, 16dp padding, min height 72dp, 24dp bottom margin, trailing `›` glyph 28sp bold.
- Streak hero number: 40sp bold `PRIMARY`; unit label `day streak` 15sp `MUTED`, 8dp left margin, baseline-aligned (row gravity BOTTOM).
- Last-30-days bar strip: each bar flex-weight 1, 2dp left margin between bars (none before the first); `DONE` bar height 24dp, every other state 2dp height.
- Last-7-days day marks: 28dp circle normal, 32dp for today. Done = filled `PRIMARY` circle + white check glyph (15sp normal / 18sp today), bold. Open (today, not yet saved) = 2dp `PRIMARY` stroke, transparent fill, no glyph. Missed = 1dp `MUTED` stroke, transparent fill, `–` glyph 18sp bold `MUTED`. No-data = 1dp dotted `DIVIDER` stroke (dash pattern 3dp/3dp), no glyph. Weekday-initial label below each mark: 11sp `MUTED`, wrap-content + centred (explicitly not match-parent, or it left-aligns under the column instead of centring under the mark — noted as a fixed-in-v1.5 defect, see `V1.5-JOURNAL.md`).
- Asymmetry hero value: 32sp bold `ASYMMETRY`; `Lower is better` 15sp `MUTED`, 8dp left margin.
- Sessions/Record-Exercise rows: 1dp `DIVIDER` row separators (Sessions card); Record-Exercise exercise rows use 14dp corner radius, **2dp `DIVIDER`-coloured border, `BG` (white) fill, NOT a filled `CARD` surface** — min height 64dp, 16dp horizontal / 14dp vertical padding, 10dp top margin between rows, trailing `›` 28sp bold `MUTED`.
- Just-saved session row highlight: 10dp corner radius, 1dp `PRIMARY` border, `HIGHLIGHT` fill, padding 10/9/10/9 (top/right/bottom/left) vs. the unhighlighted row's 0/9/0/9. Highlight auto-clears 20s after "Back to Journal" is tapped, and the row is scrolled into view exactly once when it was set via that path.
- Legend swatches: 12dp circle (left) / 12dp square with 2dp corner radius (right), ~6dp gap to label text, 20dp spacer between the two legend entries.
- Charts (`LineChartView`): fixed height 180dp (`chartParams()`), internal min height 170dp fallback. Padding inside the view: 10dp top, 22dp bottom, 46dp left (room for Y ticks), 12dp right. Line stroke 2dp, round caps; point markers 2.6dp radius (circle) or equivalent square. Y shows 3 ticks (min/mid/max). X labels: first and last always drawn and pinned inside the plot edges; up to `ceil(n/5)`-stepped middle ticks are drawn only if they don't collide with a neighbour or the pinned end labels (6dp min gap) — this is how narrow/large-text layouts avoid clipped or overlapping axis labels.
- Exercise screen timer: elapsed readout 56sp bold `PRIMARY`, centred, 24dp top margin; status 17sp `MUTED`, centred. Start/Finish buttons: 64dp min height, 21sp bold text, all-caps disabled (`setAllCaps(false)`), 14dp corner radius; filled variant white-on-`PRIMARY`, outline variant `PRIMARY`-on-white with 2dp `PRIMARY` border. "Back to Journal" button: 17sp text, 52dp min height, outline style.
- All screens respect system bars: top inset = `max(20dp, systemBarTop + 8dp)` (falls back to the `status_bar_height` resource + 8dp pre-API 30), bottom inset added to the tab bar's/content's bottom padding — no content ever draws under a system bar.

## 5. Data model

```
BraceObservation {
  wallMs: long                 // observation instant
  sessionId: String            // groups L/R readings recorded together
  sessionKey: String           // which exercise, e.g. "sit_to_stand"; "brace" for standalone
  side: String                 // "L" | "R" (constants SIDE_LEFT/SIDE_RIGHT) — "" if unknown
  provenance: String           // "replay" | "fixture" | "manual" | "ble" | ... (free text)
  unit: String                 // only "adc_counts" (UNIT_ADC_COUNTS) is documented
  calibration: String          // a calibration identity, or "uncalibrated" (UNCALIBRATED)
  raw: List<Integer>           // retained raw ADC counts, never converted
  angles: List<Double>         // valid calibrated angles in degrees; empty = unavailable
}
```
Side is provenance-declared, never inferred from packet bytes (the real BLE
packet format is undocumented/unverified — this build has no live sensor
read path at all). `isLeft()`/`isRight()` string-match `side`; `hasKnownSide()`
is false for anything else (so an unknown side is never plotted as L or R).
`isCalibrated()` is false for `null`/empty/`"uncalibrated"` (case-insensitive).

```
SessionStore.Session {
  startWallMs: long
  durationMs: long
  finishWallMs: long           // real finish time; for legacy 2-field records, start+duration
}
```

```
BraceMetrics.SessionPoint {      // one Journal chart point, one per recording session
  sessionId: String
  wallMs: long                  // earliest observation's wallMs in that session
  leftMean, rightMean: double   // NaN when that side has no observation in this session
  asymmetry: double             // NaN when unavailable (see §8 preconditions)
  leftRom, rightRom: double     // NaN when unavailable — computed but currently unused by any UI (see §9.2)
}
```

**Derived values**
- `meanReading(obs)` = arithmetic mean of `raw` (ignoring null/NaN/Inf entries), or `NaN` if none.
- `rom(obs)` = max − min over `angles` (ignoring null/NaN/Inf entries), or `null` if none. Never derived from `raw`.
- `asymmetryPercent(left, right)`: **order-dependent** — requires `left.isLeft()` AND `right.isRight()` to both be true (passing them in the other order, or two observations of the same side, returns `null`). Further preconditions, checked in this exact order: both non-null → same `unit` and non-empty → both calibrated → identical `calibration` string → both means finite. Formula once all hold: `100 * |meanL - meanR| / ((meanL + meanR) / 2)`; a zero mean yields `null` (never `0` or `Infinity`). A primitive-double overload `asymmetryPercent(double, double)` skips the metadata preconditions but keeps the finite/zero-mean checks.
- `sessions(List<BraceObservation>)` groups by `sessionId` (not by sessionKey/exercise), keeps only observations with a known side, picks the *latest-by-wallMs* observation per side per session (not an average across duplicates), and sorts the resulting points by `wallMs` then `sessionId`. A session with only one side present yields `NaN` for the other side's mean and for asymmetry — never interpolated or fabricated.

## 6. Persistence (on-device, no network, no account)

**Sessions** — `SharedPreferences` file `caretech_sessions`, one string value per
exercise key (`sit_to_stand`, `timed_up_and_go`, `walk`, `stair_climb`).
Records within a value are `;`-joined; each record is `startWallMs|durationMs|finishWallMs`
(current) or the legacy 2-field `startWallMs|durationMs` (v1.0, finish derived
as `start+duration` on every read, never rewritten in place). A corrupt
record is skipped without discarding the rest of that key's history.

**Observations** — `SharedPreferences` file `caretech_observations`, single key
`observations`, one newline-joined blob. Each line is the `BraceCodec` format:
`wallMs|sessionId|sessionKey|side|provenance|unit|calibration|rawCsv|angleCsv`,
where `rawCsv`/`angleCsv` are `;`-joined lists (angle doubles trimmed of
trailing zeros/decimal point, locale-independent). Decoding is deliberately
lenient: a line with ≥4 fields still parses (missing trailing fields default
to empty/`uncalibrated`); fewer than 4 fields, or an unparsable `wallMs`,
drops just that one line. Entries are appended only — `add()`/`importReplay()`
never rewrite or migrate existing records. `DebugFixture`'s synthetic
observations are generated in memory and are **never** persisted here, so the
debug banner's data can never leak into the real Journal (see §9.5).

## 7. Debug fixture

`DebugFixture.observations()` returns 5 fixed in-memory `BraceObservation`s
across 3 synthetic sessions (`ft-a`/`ft-b`/`ft-c`), all `calibration="fixture-cal"`,
`unit="adc_counts"`, `provenance="fixture"`: session 1 has both sides (clearly
asymmetric), session 2 has both sides (small asymmetry), session 3 has only
the left side (so its right-side mean and asymmetry are intentionally `NaN`
— used to exercise the "gap, not interpolated" chart behaviour). It is wired
up purely via an `Intent` boolean extra `caretech_fixture` (`MainActivity.EXTRA_FIXTURE`)
read in `onCreate`/`onNewIntent` — there is no button, menu, or settings
screen in the shipped app that sets this extra; it is reachable only by
launching the activity with that extra explicitly (e.g. via `adb`). When
active, the Journal prepends the debug banner and swaps `ObservationStore.all()`
for `DebugFixture.observations()` for the chart data only — `SessionStore`
(streak, week strip, sessions list, completed card) is untouched regardless,
so toggling the fixture can never move those numbers.

## 8. Streak rules (`Streak.java`)

- Source of truth: `SessionStore` only (real finished, saved sessions across
  all 4 exercises). `DebugFixture` observations, an abandoned/unfinished
  timer, and a failed attempt can never credit a day.
- Local day number = Howard Hinnant's civil-from-days algorithm applied to the
  *local* Y/M/D fields of the instant (via `Calendar` in the target
  `TimeZone`) — **not** epoch-millis integer division — so a DST transition
  occurring inside a day can never shift that day's number.
- A session is credited to the local day its **`finishWallMs`** falls on (for
  legacy 2-field records, `start + duration`). A session that starts before
  midnight and finishes after it credits the day it *finished* on.
- One credit per local calendar day — multiple exercises/sessions on the same
  day count once (`doneDays` de-duplicates via a Set before computing the
  streak).
- Current streak (`currentForDays`): let `today` = today's local day number.
  Anchor = `today` if today has a credit, else `today - 1` (today stays open
  until midnight, so a streak that ended yesterday still reads as "alive"
  all day today). If the anchor itself has no credit, streak = 0. Otherwise
  count consecutive credited days walking backward from the anchor
  (`anchor`, `anchor-1`, `anchor-2`, …) until a gap.
- Per-day states for a rolling N-day window ending today (`states()`), oldest
  first: `DONE` if credited; else `NO_DATA` if the day is before the very
  first ever credited day (never shown as a "miss" before history began);
  else `OPEN` if it is today (never a miss); else `MISSED`.
- `lastFinishMs` = max `finishWallMs` across all saved sessions, or `-1` if
  none — drives the Journal's "Last saved: …" line (today → `today, HH:mm`;
  otherwise → `d MMM`).
- The whole streak card (and the Last-7-days card) is suppressed, not shown
  with a `0`, until the very first session is ever saved.
- Verified-safe across a half-hour-offset zone (Asia/Kolkata) and across a
  Europe/Berlin DST spring-forward — civil day numbers stay consecutive.

## 9. Empty / edge states — exact triggers

1. **No session ever saved (any exercise):** Streak card, Last-7-days card
   absent entirely; first-use CTA shown instead, pointing at Record Exercise.
2. **Sessions exist but no comparable asymmetry pair in any of them:** the
   whole asymmetry card is not built; the plain fallback row
   `"Knee asymmetry — no matched recordings yet."` renders in its place.
   (Distinct from the chart-internal `"No comparable pair"` text in §2 — see
   §9.4: that text requires the card to be built in the first place but have
   no plottable values, which cannot currently happen because the card is
   only ever built once ≥1 session already has a comparable value.)
3. **Sessions exist but none has a left or right mean reading:** same
   pattern — card absent, fallback row `"Sensor readings — no brace recordings yet."`.
4. A session that has one side's reading but not the other shows as a
   **visible gap** in both charts (`LineChartView` only draws a path segment
   between two *consecutive present* points; a `NaN` breaks the line rather
   than being interpolated across) — never plotted as 0.
5. **ROM unavailable** for the just-finished session (no calibrated angle
   record within ±1s of its start/finish window): exact copy
   `"Range of motion: unavailable (no calibrated angle record)"`. ROM is
   computed independently per side; one side can be available while the
   other reads `"unavailable"` in the same line.
6. **Per-exercise history empty** (`ExerciseActivity`): `"No sessions recorded yet."`.
7. **Debug banner** only ever appears with the explicit `caretech_fixture`
   intent extra (§7) — never from any in-app affordance.

## 10. Native automated tests (`CareTechTests.java`, run via `tests/run.sh`)

Plain `main()` harness, no JUnit (no Gradle in this source tree). At the time
of the v1.5 delivery: **66 passed, 0 failed** (48 pre-existing + 18 new streak
cases, per `V1.5-JOURNAL.md`). Test functions, in file order:

1. `twoKneesAsymmetry` — `100 * |1200-1500| / 1350 ≈ 22.2222`.
2. `equalValuesZeroAsymmetry` — identical L/R means → exactly `0.0`.
3. `zeroDenominatorUnavailable` — zero mean → `null`, both via the
   `BraceObservation` overload and the raw-`double` overload.
4. `missingAndInvalidUnavailable` — missing side, `NaN`, `Infinity`, and
   all-empty-samples each → `null`.
5. `preconditionsUnavailable` — uncalibrated pair, mismatched calibration id,
   mismatched unit, same side twice, and an unknown/unlabelled side each →
   `null`.
6. `sessionGroupingLeavesGaps` — 3 sessions, one with only a left reading →
   exactly one `SessionPoint` per session, chronological order, the
   incomplete session's right mean and asymmetry are `NaN` (not 0/interpolated).
7. `romOnlyFromValidAngles` — ROM = max−min of valid angles (ignoring a
   trailing `NaN`); `null` with no angles; never derived from raw counts.
8. `codecRoundTrip` — encode→decode preserves every field exactly, including
   the documented literal line format; `decodeAll` reads multiple lines.
9. `legacyLineStillUsable` — a 4-field truncated line still parses, as
   uncalibrated with empty angles/raw.
10. `malformedLineSkipped` — one garbage/number-parse-failure line among
    valid ones is dropped without losing the valid ones.
11. `legacySessionRecord` — legacy 2-field record derives `finish = start+duration`;
    a corrupt record among valid ones is skipped; empty/`null` payload → `[]`.
12. `fixtureIsLabelledAndGapped` — fixture has 5 observations/3 sessions, its
    provenance is `"fixture"`, its 3rd session has a right-side gap, its 1st
    pair is comparable and asymmetric.
13. `chartAxisLabelsStayDistinct` — same-day sessions get a time suffix so
    labels stay unique; a session alone on its day stays day-only; empty/null
    input → `[]`.
14. `streakCases` — the full matrix: zero sessions (every day `NO_DATA`, never
    `MISSED`); today-only (`1`, yesterday `NO_DATA`); yesterday-only with
    today still open (`1`, today reads `OPEN`); a missed day before yesterday
    (still `1`); nothing today or yesterday (`0`); 3 consecutive days ending
    yesterday (`3`); 4 consecutive ending today (`4`); two sessions same day
    count once (`1`); yesterday×2 + today (`2`); `doneDays` de-dupes a repeated
    day; a session spanning midnight credits its *finish* day; a legacy
    2-field record credits start+duration's day; day numbers stay consecutive
    across the Berlin DST spring-forward and a 4-day streak survives it; a
    half-hour-offset zone (Kolkata) credits its own local day; fixture
    observations existing never credit a day (`Streak.current` only reads
    `SessionStore`).

## 11. Ambiguities and discrepancies found (recorded, not resolved by invention)

- **Version number mismatch inside the native project's own docs.** `V1.5-JOURNAL.md`'s
  deliverable table says `versionCode / versionName: 7 / 1.5`, but the same
  file's "what changed in the source" section and the actual
  `AndroidManifest.xml` both say `versionCode="8"`. Per this task's
  instruction to treat `MainActivity.java`/the manifest as authoritative,
  **8** is the correct current versionCode; the journal's summary table line
  is stale.
- **`asymmetryPercent(BraceObservation, BraceObservation)` is order-dependent,
  not symmetric.** The first argument must satisfy `isLeft()` and the second
  `isRight()`; swapping them returns `null` even for an otherwise-valid pair.
  A port that treats this as "any two comparable observations, either order"
  would silently diverge from native behaviour. (The primitive-`double`
  overload has no such order constraint — only the mean/finite/zero checks.)
- **`SessionPoint.leftRom`/`rightRom` are computed but never rendered.**
  `BraceMetrics.sessions()` always populates them, but no code in
  `MainActivity`'s Journal reads them — ROM is only ever shown in
  `ExerciseActivity`'s post-session receipt, computed directly from
  `ObservationStore.all()` for that one session's time window, not via
  `BraceMetrics.sessions()`. Not a requirement to add a ROM chart to the
  Journal unless Dan asks for one; flagged so it isn't assumed to be a
  missing feature.
- **The in-chart `"No comparable pair"` / `"No brace recordings"` empty text
  in `LineChartView` is effectively unreachable in the shipped build.**
  `MainActivity.buildJournal()` only constructs the asymmetry/reading card at
  all when `hasAsymmetry`/`hasReadings` is already true for at least one
  session, so the chart it builds is guaranteed to have ≥1 plottable point by
  construction. The reachable "nothing to show" UI is the card-level fallback
  row (§9.2/9.3), not this chart-internal text. A literal port should still
  carry the chart-internal text (it's real, tested-adjacent code the generic
  `LineChartView` equivalent will need for any future case where it *is*
  reachable) but should not expect to ever see it rendered in today's Journal.
- **`src/theme.ts` in this repo (already-existing RN port) references
  `docs/reference/native-v1.5-tokens.md` in its header comment** as "the full
  measurement notes" — no such file exists in this repo; the actual
  measurements live in this document (`docs/port-spec.md`) and in the
  `t_ae69a023` task handoff. Flagging rather than silently renaming/creating
  a file outside this audit's scope; a future small commit should either
  create that file or fix the comment to point here.
- **Fixture vs. `SimulatedSource` are not equivalent concepts**, even though
  both exist to show data without a real brace. Native `DebugFixture` is
  intent-extra-gated and unreachable through any in-app control (§7/§9.7); the
  already-built RN port's `SimulatedSource` is its *default* sensor source
  (per `t_750bc157`'s explicit acceptance criteria). This is a deliberate,
  documented departure from the native gating, not an omission — recorded here
  so it isn't mistaken for a missed requirement on a future audit.

## 12. Reference asset

`docs/reference/native-v1.5-reference.jpg` — Dan's phone screenshot of the
target v1.5 layout, already present in this repo (copied from
`/home/dan/.hermes/cache/documents/native-inputs/26b00745bc94c9e837b6844f26c21a9f8515d4ac7f1e0ec33a1c986c859f87d7/img_ffebc2d265d1.jpg`
by an earlier run of this workspace's build task). Re-verified byte-for-byte
present at that path during this audit; not re-copied under a second name.

## 13. Web prior-art considered (`CareTech-Web`, read-only, not modified)

Reviewed for reusable *ideas* only, per task scope — not copied verbatim,
and the web app itself was left untouched:
- `js/sensors.js` — `SensorSource` adapter contract (`connect(onSample, onStatus)`/`disconnect()`),
  a `SimulatedSource` with two independently-drifting sinusoidal+noise
  baselines per side, and a `WebBluetoothSource` stub that throws with an
  explicit "no protocol defined yet" error and TODOs for the not-yet-built
  ESP32 GATT layer — never wired into the UI.
- `js/streak.js` — a faithful JS port of the same civil-day/anchor algorithm
  as native `Streak.java` (confirmed matching logic, not just matching
  intent).
- `js/metrics.js` — same asymmetry formula, `null`-on-unavailable (not the
  order-dependent native precondition chain — the web version takes plain
  means directly, sidestepping the L/R-argument-order issue in §11).
- `js/store.js` — trivial `localStorage`-backed session list, JSON-encoded;
  simpler than native's per-exercise-key `SharedPreferences` scheme but not
  contract-equivalent (no legacy 2-field migration path, no per-exercise
  keying).
