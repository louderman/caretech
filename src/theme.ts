/**
 * Design tokens for CareTech, measured from the native Android v1.5 source
 * (MainActivity.java) — see docs/reference/native-v1.5-tokens.md for the full
 * measurement notes. Keep every colour, spacing and radius value HERE so a
 * future design-language pass only has to touch this one file.
 */

export const colors = {
  bg: '#FFFFFF',
  ink: '#17212B',
  muted: '#5A6470',
  primary: '#1F6F6B',
  card: '#F1F5F5',
  divider: '#E3E8E8',
  success: '#1B7F4B',
  /** One-time tint for the session row the exercise screen has just written. */
  highlight: '#EAF4F2',
  /** Series colours; shape and stroke differ too, so the pairing is never colour-only. */
  sensorLeft: '#1F6F6B',
  sensorRight: '#B4601A',
  asymmetry: '#6B3FA0',
  /** Debug-fixture banner only (never shown in production use). */
  debugText: '#7A3E00',
  debugBg: '#FFF1D6',
  debugBorder: '#E0B172',
  white: '#FFFFFF',
  axis: '#B9C2C6',
  tick: '#5A6470',
} as const;

export const radii = {
  card: 16,
  recordCta: 14,
  highlightRow: 10,
  exerciseRow: 14,
  button: 14,
} as const;

export const spacing = {
  screenX: 20,
  screenBottom: 28,
  screenTopMin: 20,
  cardPadding: 16,
  cardGap: 24,
  cardGapNoCharts: 22,
} as const;

export const borders = {
  card: 1,
  recordCta: 2,
  highlightRow: 1,
  exerciseRow: 2,
} as const;

export const type = {
  cardTitle: { fontSize: 17, fontWeight: '700' as const },
  streakNumber: { fontSize: 40, fontWeight: '700' as const },
  streakUnit: { fontSize: 15, fontWeight: '400' as const },
  sectionLabel: { fontSize: 19, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, fontWeight: '700' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
  dayCheck: { fontSize: 15, fontWeight: '700' as const },
  dayCheckToday: { fontSize: 18, fontWeight: '700' as const },
  dayInitial: { fontSize: 11, fontWeight: '400' as const },
  asymmetryValue: { fontSize: 32, fontWeight: '700' as const },
  recordCtaTitle: { fontSize: 17, fontWeight: '700' as const },
  recordCtaSub: { fontSize: 14, fontWeight: '400' as const },
  exerciseTitle: { fontSize: 17, fontWeight: '700' as const },
  exerciseHint: { fontSize: 14, fontWeight: '400' as const },
  tab: { fontSize: 17, fontWeight: '400' as const },
} as const;

/** Last 7 days day-mark sizes. */
export const dayMark = {
  size: 28,
  sizeToday: 32,
} as const;

/** Last 30 days bar-strip heights. */
export const bar = {
  done: 24,
  other: 2,
} as const;

/** Just-saved session row padding (top/right/bottom/left in the native order 10/9/10/9). */
export const highlightRowPadding = {
  top: 10,
  right: 9,
  bottom: 10,
  left: 9,
} as const;

export const theme = { colors, radii, spacing, borders, type, dayMark, bar, highlightRowPadding };
export default theme;
