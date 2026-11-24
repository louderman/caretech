import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radii, borders, type as typeScale, dayMark, bar as barTok, highlightRowPadding } from '../theme';
import type { DayState } from '../core/types';
import { DONE, OPEN, MISSED } from '../core/types';
import type { SessionPoint } from '../core/types';
import { LineChart } from './LineChart';

/** One bounded card: a rounded CARD-filled surface with a hairline divider edge, on white. */
export function Card({
  topMargin = 0,
  title,
  children,
}: {
  topMargin?: number;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.card, { marginTop: topMargin }]}>
      {!!title && <Text style={styles.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

/** First-use prompt: one tappable card that opens the Record Exercise tab. */
export function RecordCta({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Record your first exercise. Opens the Record Exercise tab."
      style={styles.recordCta}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.recordCtaTitle}>Record your first exercise</Text>
        <Text style={styles.recordCtaSub}>Pick one of 4 exercises and start a timer — no setup needed.</Text>
      </View>
      <Text style={styles.chevron}>{'\u203A'}</Text>
    </Pressable>
  );
}

/** One plain line standing in for a chart with nothing to plot. */
export function EmptyChartRow({ title, status, topMargin = 0 }: { title: string; status: string; topMargin?: number }) {
  return (
    <Text style={[styles.emptyChartRow, { marginTop: topMargin }]}>
      {title} — {status}.
    </Text>
  );
}

export function DebugBanner() {
  return (
    <Text style={styles.debugBanner}>Debug preview — synthetic fixture. Not real recordings, never saved.</Text>
  );
}

/** Streak hero: big number, "day streak", last-saved line, Last 30 days bar strip. */
export function StreakCard({
  streak,
  lastSavedLine,
  states30,
}: {
  streak: number;
  lastSavedLine: string;
  states30: DayState[];
}) {
  return (
    <Card>
      <View style={styles.streakRow}>
        <Text style={styles.streakNumber}>{streak}</Text>
        <Text style={styles.streakUnit}>day streak</Text>
      </View>
      {!!lastSavedLine && <Text style={styles.lastSaved}>{lastSavedLine}</Text>}
      <Text style={styles.last30Caption}>Last 30 days</Text>
      <View style={styles.barsRow}>
        {states30.map((s, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { marginLeft: i > 0 ? 2 : 0 },
              { height: s === DONE ? barTok.done : barTok.other },
              { backgroundColor: s === DONE ? colors.primary : colors.divider },
            ]}
          />
        ))}
      </View>
    </Card>
  );
}

/** Seven compact day marks for the last seven local days, ending today. */
export function WeekStripCard({ starts, states, topMargin = 0 }: { starts: number[]; states: DayState[]; topMargin?: number }) {
  return (
    <Card topMargin={topMargin} title="Last 7 days">
      <View style={styles.weekRow}>
        {starts.map((ms, i) => (
          <DayMark key={i} dayStartMs={ms} state={states[i]} today={i === starts.length - 1} />
        ))}
      </View>
    </Card>
  );
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function DayMark({ dayStartMs, state, today }: { dayStartMs: number; state: DayState; today: boolean }) {
  const size = today ? dayMark.sizeToday : dayMark.size;
  const d = new Date(dayStartMs);
  const initial = WEEKDAY_INITIALS[d.getDay()];
  let markStyle;
  let glyph = '';
  let glyphStyle: { fontWeight: '700'; fontSize: number; color: string } = {
    fontWeight: '700',
    fontSize: today ? typeScale.dayCheckToday.fontSize : typeScale.dayCheck.fontSize,
    color: colors.ink,
  };
  if (state === DONE) {
    markStyle = { backgroundColor: colors.primary };
    glyph = '\u2713';
    glyphStyle = { ...glyphStyle, color: colors.white };
  } else if (state === OPEN) {
    markStyle = { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary };
  } else if (state === MISSED) {
    markStyle = { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.muted };
    glyph = '\u2013';
    glyphStyle = { ...glyphStyle, color: colors.muted };
  } else {
    markStyle = { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.divider, borderStyle: 'dashed' as const };
  }
  return (
    <View style={styles.dayCol}>
      <View style={[styles.dayMark, { width: size, height: size, borderRadius: size / 2 }, markStyle]}>
        {!!glyph && <Text style={glyphStyle}>{glyph}</Text>}
      </View>
      <Text style={styles.dayInitial}>{initial}</Text>
    </View>
  );
}

export interface SessionRowData {
  name: string;
  key: string;
  startWallMs: number;
  durationMs: number;
  finishWallMs: number;
  highlighted: boolean;
}

function stamp(ms: number): string {
  const d = new Date(ms);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]}, ${hh}:${mm}`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** All saved sessions across the four exercises, newest first — the one section every user has. */
export function SessionsCard({ rows }: { rows: SessionRowData[] }) {
  const shown = rows.slice(0, 12);
  return (
    <Card topMargin={24} title="Sessions">
      {rows.length === 0 ? (
        <Text style={styles.mutedBody}>No sessions recorded yet.</Text>
      ) : (
        <>
          {shown.map((r, i) => (
            <View key={`${r.key}-${r.startWallMs}-${i}`}>
              <View
                style={[
                  styles.sessionRow,
                  r.highlighted && styles.sessionRowHighlighted,
                ]}
              >
                <Text style={styles.sessionName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.sessionStamp}>{stamp(r.startWallMs)}</Text>
                <Text style={styles.sessionDuration}>  {formatDuration(r.durationMs)}</Text>
              </View>
              {i < shown.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
          {rows.length > shown.length && (
            <Text style={styles.mutedCaption}>
              Showing the {shown.length} most recent of {rows.length} sessions.
            </Text>
          )}
        </>
      )}
    </Card>
  );
}

/** Knee asymmetry %: the last known value and direction, then the chart and short copy. */
export function AsymmetryCard({ points, labels, topMargin = 0 }: { points: SessionPoint[]; labels: string[]; topMargin?: number }) {
  let latest = NaN;
  for (let i = points.length - 1; i >= 0; i--) {
    if (!Number.isNaN(points[i].asymmetry)) {
      latest = points[i].asymmetry;
      break;
    }
  }
  return (
    <Card topMargin={topMargin} title="Knee asymmetry (%)">
      <View style={styles.streakRow}>
        <Text style={styles.asymmetryValue}>{Number.isNaN(latest) ? '—' : `${latest.toFixed(1)}%`}</Text>
        <Text style={styles.lowerIsBetter}>Lower is better</Text>
      </View>
      <LineChart
        decimals={1}
        emptyText="No comparable pair"
        xLabels={labels}
        zeroFloor
        series={[{ name: 'asymmetry', color: colors.asymmetry, values: points.map((p) => p.asymmetry) }]}
      />
      <HintBlock
        primary="How evenly the two knees are loaded, from matched recordings only."
        detail="Formula: 100 × |left − right| ÷ average. Shown only when both knees have a recording from the same session; other sessions are gaps."
      />
    </Card>
  );
}

/** Sensor readings: solid round left knee, dashed square right knee. */
export function ReadingsCard({ points, labels, topMargin = 0 }: { points: SessionPoint[]; labels: string[]; topMargin?: number }) {
  return (
    <Card topMargin={topMargin} title="Sensor readings (raw counts)">
      <Legend />
      <LineChart
        decimals={0}
        emptyText="No brace recordings"
        xLabels={labels}
        series={[
          { name: 'Left knee', color: colors.sensorLeft, values: points.map((p) => p.leftMean) },
          { name: 'Right knee', color: colors.sensorRight, values: points.map((p) => p.rightMean), dashed: true, squareMarkers: true },
        ]}
      />
      <HintBlock
        primary="Each knee's average raw sensor reading per session — not a measurement of force or resistance."
        detail="Raw 12-bit ADC counts from the brace sensor. A knee with no recording that session is a gap, never zero."
      />
    </Card>
  );
}

/** Legend key: the swatch shape matches the marker the series draws, so it is not colour-only. */
function Legend() {
  return (
    <View>
      <View style={styles.legendRow}>
        <View style={[styles.swatchDot, { backgroundColor: colors.sensorLeft }]} />
        <Text style={styles.legendText}>Left knee</Text>
        <View style={{ width: 20 }} />
        <View style={[styles.swatchSquare, { backgroundColor: colors.sensorRight }]} />
        <Text style={styles.legendText}>Right knee</Text>
      </View>
      <Text style={styles.legendKey}>
        Solid line with round points: left knee. Dashed line with square points: right knee.
      </Text>
    </View>
  );
}

function HintBlock({ primary, detail }: { primary: string; detail?: string }) {
  return (
    <View style={styles.hintBlock}>
      <Text style={styles.hintPrimary}>{primary}</Text>
      {!!detail && <Text style={styles.hintDetail}>{detail}</Text>}
    </View>
  );
}

/** Compact completion: plain words, no date header, in a bounded card. */
export function CompletedCard({ rows, topMargin = 0 }: { rows: { name: string; done: boolean }[]; topMargin?: number }) {
  return (
    <Card topMargin={topMargin} title="Completed">
      {rows.map((r, i) => (
        <View key={i} style={styles.completedRow}>
          <Text style={styles.completedName}>{r.name}</Text>
          <Text style={[styles.completedState, { color: r.done ? colors.primary : colors.muted }]}>
            {r.done ? 'done' : 'not yet'}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: colors.divider,
    padding: 16,
  },
  cardTitle: { ...typeScale.cardTitle, color: colors.ink, marginBottom: 10 },
  streakRow: { flexDirection: 'row', alignItems: 'flex-end' },
  streakNumber: { ...typeScale.streakNumber, color: colors.primary },
  streakUnit: { ...typeScale.streakUnit, color: colors.muted, marginLeft: 8, marginBottom: 6 },
  lastSaved: { ...typeScale.caption, color: colors.muted, textAlign: 'right', marginTop: 4 },
  last30Caption: { ...typeScale.small, color: colors.muted, marginTop: 14 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6, height: 24 },
  bar: { flex: 1, borderRadius: 1 },
  weekRow: { flexDirection: 'row', alignItems: 'flex-end' },
  dayCol: { flex: 1, alignItems: 'center' },
  dayMark: { alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  dayCheck: { ...typeScale.dayCheck, fontWeight: '700' },
  dayInitial: { ...typeScale.dayInitial, color: colors.muted },
  mutedBody: { ...typeScale.body, color: colors.muted },
  mutedCaption: { ...typeScale.caption, color: colors.muted, marginTop: 4 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  sessionRowHighlighted: {
    backgroundColor: colors.highlight,
    borderRadius: radii.highlightRow,
    borderWidth: borders.highlightRow,
    borderColor: colors.primary,
    paddingTop: highlightRowPadding.top,
    paddingRight: highlightRowPadding.right,
    paddingBottom: highlightRowPadding.bottom,
    paddingLeft: highlightRowPadding.left,
  },
  sessionName: { ...typeScale.body, color: colors.ink, flex: 1 },
  sessionStamp: { ...typeScale.caption, color: colors.muted },
  sessionDuration: { ...typeScale.bodyBold, color: colors.primary },
  divider: { height: 1, backgroundColor: colors.divider },
  asymmetryValue: { ...typeScale.asymmetryValue, color: colors.asymmetry },
  lowerIsBetter: { ...typeScale.body, color: colors.muted, marginLeft: 8, marginBottom: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  swatchDot: { width: 12, height: 12, borderRadius: 6 },
  swatchSquare: { width: 12, height: 12, borderRadius: 2 },
  legendText: { ...typeScale.body, color: colors.ink, marginLeft: 6 },
  legendKey: { ...typeScale.caption, color: colors.muted, marginTop: 4 },
  hintBlock: { marginTop: 10 },
  hintPrimary: { ...typeScale.body, color: colors.ink },
  hintDetail: { ...typeScale.caption, color: colors.muted, marginTop: 4 },
  completedRow: { flexDirection: 'row', paddingVertical: 6 },
  completedName: { ...typeScale.body, color: colors.ink, flex: 1 },
  completedState: { ...typeScale.caption },
  recordCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radii.recordCta,
    borderWidth: borders.recordCta,
    borderColor: colors.primary,
    padding: 16,
    minHeight: 72,
    marginBottom: 24,
  },
  recordCtaTitle: { ...typeScale.recordCtaTitle, color: colors.primary },
  recordCtaSub: { ...typeScale.recordCtaSub, color: colors.muted, marginTop: 4 },
  chevron: { fontSize: 28, fontWeight: '700', color: colors.primary },
  emptyChartRow: { ...typeScale.body, color: colors.muted, minHeight: 48, textAlignVertical: 'center' },
  debugBanner: {
    ...typeScale.bodyBold,
    fontSize: 14,
    color: colors.debugText,
    backgroundColor: colors.debugBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.debugBorder,
    padding: 12,
    marginBottom: 16,
  },
});
