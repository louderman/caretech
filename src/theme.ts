/**
 * Design tokens for CareTech's "Progress story" redesign.
 *
 * Structural pattern borrowed from Dan's Midnight Atlas / DreamFree design system
 * (/home/dan/Documents/DreamFree/dreamfree/lib/theme.ts + DESIGN.md) — COLORS / FONTS / THEME
 * constants, Platform.select font families, glass-card helpers — but re-coloured from Midnight
 * Atlas's cosmic violet onto CareTech's own white-and-green "Progress story" palette with soft
 * mint gradients. Nothing here is copied visually from Midnight Atlas; only the file shape is.
 *
 * Keeps the flat legacy tokens (colors/radii/spacing/borders/type/...) that the ported-from-native
 * Details/Record/Exercise screens already import, re-pointed at the new palette, so the whole app
 * stays on ONE swappable source of truth instead of forking into two theme files.
 */
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// COLORS — Midnight-Atlas-shaped token set, CareTech "Progress story" values.
// ---------------------------------------------------------------------------
export const COLORS = {
  background: '#FFFFFF',
  surface: '#F4FAF6',
  surfaceCard: 'rgba(255, 255, 255, 0.72)', // glass card over the mint gradient wash
  surfaceCardActive: 'rgba(224, 247, 234, 0.88)', // hero / selected card variant
  border: 'rgba(21, 110, 69, 0.18)', // ~18% opacity outline
  borderActive: 'rgba(21, 110, 69, 0.38)',
  primary: '#17895A', // confident health green, not neon
  primaryDim: '#0F6B45',
  mint: '#DFF4E8', // positive-state / improving tint
  positive: '#17895A',
  warn: '#B4601A',
  highlight: '#C8860B', // amber/gold — personal bests only
  text: '#15241D', // near-black slate
  textSecondary: '#44564C',
  muted: '#6C8077',
  textOnPrimary: '#FFFFFF',
  error: '#B3261E',
  divider: '#E1EEE6',
  card: '#F1F5F5', // legacy flat-card fill (Details/Record/Exercise screens)
  white: '#FFFFFF',
  sensorLeft: '#17895A',
  sensorRight: '#B4601A',
  asymmetry: '#6B3FA0',
  debugText: '#7A3E00',
  debugBg: '#FFF1D6',
  debugBorder: '#E0B172',
  axis: '#C3D6CC',
  tick: '#6C8077',
  shadowColor: 'rgba(23, 137, 90, 0.16)',
  shadowColorActive: 'rgba(23, 137, 90, 0.26)',
} as const;

/** Large-radius background washes, for expo-linear-gradient. Atmosphere, not decoration. */
export const GRADIENTS = {
  /** Faint green radial wash behind the Home hero — white to pale mint. */
  home: ['#FFFFFF', '#E9F8EF', '#FFFFFF'] as const,
  /** Subtle wash for Details/Record/Exercise headers. */
  subtle: ['#FFFFFF', '#F3FBF6'] as const,
};

export const FONTS = {
  display: Platform.select({
    ios: 'Avenir-Heavy',
    android: 'sans-serif-condensed',
    web: 'Sora, sans-serif',
    default: 'sans-serif-medium',
  }),
  heading: Platform.select({
    ios: 'Avenir-Heavy',
    android: 'sans-serif-medium',
    web: 'Sora, sans-serif',
    default: 'sans-serif-medium',
  }),
  body: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: 'Plus Jakarta Sans, sans-serif',
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'CourierNewPS-BoldMT',
    android: 'monospace',
    web: 'JetBrains Mono, monospace',
    default: 'monospace',
  }),
};

/** Loaded by App.tsx via @expo-google-fonts so web and native render the same families. */
export const FONT_ASSETS = {
  Sora_700Bold: 'Sora_700Bold',
  Sora_800ExtraBold: 'Sora_800ExtraBold',
  PlusJakartaSans_400Regular: 'PlusJakartaSans_400Regular',
  PlusJakartaSans_600SemiBold: 'PlusJakartaSans_600SemiBold',
  JetBrainsMono_600SemiBold: 'JetBrainsMono_600SemiBold',
  JetBrainsMono_700Bold: 'JetBrainsMono_700Bold',
} as const;

export const THEME = {
  glassCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: `0 4px 12px ${COLORS.shadowColor}`,
      },
    }),
  } as any,
  glassCardActive: {
    backgroundColor: COLORS.surfaceCardActive,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.shadowColorActive,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: `0 6px 16px ${COLORS.shadowColorActive}`,
      },
    }),
  } as any,
  /** Monospaced, uppercase, tracked label for every stat/counter/date/unit (streak, %, PBs, "WEEK 6"). */
  statLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  } as any,
  statValue: {
    fontFamily: FONTS.mono,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: COLORS.text,
  } as any,
  formLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  } as any,
  formInput: {
    backgroundColor: 'rgba(23, 137, 90, 0.04)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 13,
  } as any,
  optionButton: {
    backgroundColor: 'rgba(23, 137, 90, 0.04)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '46%',
    flexGrow: 1,
  } as any,
  optionButtonActive: {
    backgroundColor: 'rgba(23, 137, 90, 0.12)',
    borderColor: COLORS.borderActive,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '46%',
    flexGrow: 1,
  } as any,
};

export const SPACE = {
  unit: 4,
  gutter: 16,
  marginMobile: 20,
  stackSm: 8,
  stackMd: 24,
  stackLg: 48,
} as const;

// ---------------------------------------------------------------------------
// Legacy flat tokens — used as-is by the ported-from-native Details/Record/Exercise
// screens (src/components/Journal.tsx, src/screens/{RecordScreen,ExerciseScreen}.tsx).
// Values are re-pointed at COLORS above so there is exactly one palette in the app.
// ---------------------------------------------------------------------------
export const colors = {
  bg: COLORS.background,
  ink: COLORS.text,
  muted: COLORS.muted,
  primary: COLORS.primary,
  card: COLORS.card,
  divider: COLORS.divider,
  success: COLORS.positive,
  highlight: COLORS.mint,
  sensorLeft: COLORS.sensorLeft,
  sensorRight: COLORS.sensorRight,
  asymmetry: COLORS.asymmetry,
  debugText: COLORS.debugText,
  debugBg: COLORS.debugBg,
  debugBorder: COLORS.debugBorder,
  white: COLORS.white,
  axis: COLORS.axis,
  tick: COLORS.tick,
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

export const theme = {
  COLORS,
  GRADIENTS,
  FONTS,
  FONT_ASSETS,
  THEME,
  SPACE,
  colors,
  radii,
  spacing,
  borders,
  type,
  dayMark,
  bar,
  highlightRowPadding,
};
export default theme;
