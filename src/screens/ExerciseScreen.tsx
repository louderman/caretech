import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, COLORS, THEME, GRADIENTS, radii, spacing, type as typeScale } from '../theme';
import { NAMES, KEYS, HINTS } from '../core/exercises';
import * as SessionStore from '../core/sessionStore';
import * as ObservationStore from '../core/observationStore';
import * as BraceMetrics from '../core/braceMetrics';
import { createDefaultSource, type SensorSource, type SensorSide } from '../core/sensorSource';
import type { Session } from '../core/types';
import { UNIT_ADC_COUNTS } from '../core/types';
import { formatDuration } from '../components/Journal';

export interface ExerciseScreenProps {
  index: number;
  onBackToJournal: (highlight: { key: string; startWallMs: number }) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "EEE d MMM yyyy, HH:mm" — native ExerciseActivity.formatDate(). */
function formatDate(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/** Calibration identity simulated sessions are tagged with; never UNCALIBRATED, never real. */
const SIM_CAL = 'rn-simulated';

export function ExerciseScreen({ index, onBackToJournal }: ExerciseScreenProps) {
  const name = NAMES[index];
  const key = KEYS[index];
  const hint = HINTS[index];

  const [running, setRunning] = React.useState(false);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [savedStartWallMs, setSavedStartWallMs] = React.useState<number | null>(null);
  const [summary, setSummary] = React.useState<{ duration: number; dateMs: number; rom: string } | null>(null);
  const [history, setHistory] = React.useState<Session[]>([]);

  const sourceRef = React.useRef<SensorSource | null>(null);
  const samplesRef = React.useRef<{ left: number[]; right: number[] }>({ left: [], right: [] });
  const startWallRef = React.useRef(0);
  const startedAtRef = React.useRef(0);
  const tickRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshHistory = React.useCallback(async () => {
    setHistory(await SessionStore.get(key));
  }, [key]);

  React.useEffect(() => {
    refreshHistory();
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      sourceRef.current?.disconnect();
    };
  }, [refreshHistory]);

  async function startSession() {
    setRunning(true);
    setSummary(null);
    setElapsedMs(0);
    startWallRef.current = Date.now();
    startedAtRef.current = Date.now();
    samplesRef.current = { left: [], right: [] };

    const src = createDefaultSource();
    sourceRef.current = src;
    await src.connect((side: SensorSide, value: number) => {
      samplesRef.current[side].push(value);
    });

    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
  }

  async function finishSession() {
    if (!running) return;
    setRunning(false);
    if (tickRef.current) clearInterval(tickRef.current);
    await sourceRef.current?.disconnect();

    const duration = Date.now() - startedAtRef.current;
    const finishWallMs = Date.now();
    const startWallMs = startWallRef.current;

    await SessionStore.add(key, startWallMs, duration, finishWallMs);

    const sessionId = `${key}-${startWallMs}`;
    const { left, right } = samplesRef.current;
    if (left.length > 0) {
      await ObservationStore.add({
        wallMs: startWallMs,
        sessionId,
        sessionKey: key,
        side: 'L',
        provenance: 'simulated',
        unit: UNIT_ADC_COUNTS,
        calibration: SIM_CAL,
        raw: left,
        angles: [],
      });
    }
    if (right.length > 0) {
      await ObservationStore.add({
        wallMs: startWallMs,
        sessionId,
        sessionKey: key,
        side: 'R',
        provenance: 'simulated',
        unit: UNIT_ADC_COUNTS,
        calibration: SIM_CAL,
        raw: right,
        angles: [],
      });
    }

    setSavedStartWallMs(startWallMs);
    setSummary({ duration, dateMs: startWallMs, rom: await romLine(key, startWallMs, finishWallMs) });
    setElapsedMs(duration);
    refreshHistory();
  }

  const shownHistory = [...history].reverse().slice(0, 10);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={GRADIENTS.subtle} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <Text style={styles.romCaption}>
        Range of motion shows only if a calibrated angle record exists for this session.
      </Text>

      {summary && (
        <View style={[THEME.glassCardActive, styles.receipt]}>
          <View style={styles.receiptAccent} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.receiptHeading}>Session saved</Text>
            <Text style={styles.receiptDetail}>
              {`Exercise: ${name}\nDate: ${formatDate(summary.dateMs)}\nDuration: ${formatDuration(summary.duration)}\n${summary.rom}`}
            </Text>
          </View>
        </View>
      )}

      {summary && savedStartWallMs != null && (
        <Pressable
          onPress={() => onBackToJournal({ key, startWallMs: savedStartWallMs })}
          accessibilityRole="button"
          accessibilityLabel="Back to Journal. Shows the session that was just saved."
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to Journal</Text>
        </Pressable>
      )}

      <Text style={styles.elapsed}>{formatDuration(elapsedMs)}</Text>
      <Text style={styles.status}>{running ? 'Timing …' : summary ? 'Finished' : 'Ready'}</Text>

      <View style={styles.controlsRow}>
        <Pressable
          disabled={running}
          onPress={startSession}
          style={[styles.bigButtonFilled, running && styles.disabled]}
        >
          <Text style={styles.bigButtonFilledText}>Start</Text>
        </Pressable>
        <Pressable
          disabled={!running}
          onPress={finishSession}
          style={[styles.bigButtonFilled, !running && styles.disabled, { marginLeft: 8, marginRight: 0 }]}
        >
          <Text style={styles.bigButtonFilledText}>Finish</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionHeader}>Your sessions for {name.toLowerCase()}</Text>
      {shownHistory.length === 0 ? (
        <Text style={styles.mutedBody}>No sessions recorded yet.</Text>
      ) : (
        shownHistory.map((s, i) => (
          <View key={`${s.startWallMs}-${i}`}>
            <View style={styles.historyRow}>
              <Text style={styles.historyDate}>{formatDate(s.startWallMs)}</Text>
              <Text style={styles.historyDuration}>{formatDuration(s.durationMs)}</Text>
            </View>
            <View style={styles.historyDivider} />
          </View>
        ))
      )}
      {history.length > 10 && <Text style={styles.mutedCaption}>Showing the 10 most recent sessions.</Text>}

      <Text style={styles.disclaimer}>
        Time alone is a personal record, not a score — a longer session can mean more repetitions
        or a steadier pace.
      </Text>
      </ScrollView>
    </View>
  );
}

/** Range of motion for this session's recording, from calibrated angles only (native romLine). */
async function romLine(key: string, startWallMs: number, finishWallMs: number): Promise<string> {
  const all = await ObservationStore.all();
  let left: number | null = null;
  let right: number | null = null;
  for (const o of all) {
    if (o.sessionKey !== key) continue;
    if (o.wallMs < startWallMs - 1000 || o.wallMs > finishWallMs + 1000) continue;
    const r = BraceMetrics.rom(o);
    if (r == null) continue;
    if (o.side === 'L') left = r;
    else if (o.side === 'R') right = r;
  }
  if (left == null && right == null) return 'Range of motion: unavailable (no calibrated angle record)';
  const deg = (v: number | null) => (v == null ? 'unavailable' : `${v.toFixed(1)} deg`);
  return `Range of motion: left ${deg(left)}, right ${deg(right)}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTopMin,
    paddingBottom: 40,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  hint: { ...typeScale.body, color: colors.muted, marginTop: 6 },
  romCaption: { ...typeScale.caption, color: colors.muted, marginTop: 10 },
  receipt: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingLeft: 0,
    paddingRight: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  receiptAccent: { width: 4, backgroundColor: colors.success, borderRadius: 2 },
  receiptHeading: { ...typeScale.cardTitle, color: colors.success },
  receiptDetail: { ...typeScale.bodyBold, fontWeight: '400', color: colors.ink, marginTop: 6, lineHeight: 22 },
  backButton: {
    borderRadius: radii.button,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  backButtonText: { ...typeScale.body, fontSize: 17, fontWeight: '700', color: colors.primary },
  elapsed: { fontSize: 56, fontWeight: '700', color: colors.primary, textAlign: 'center', marginTop: 24 },
  status: { ...typeScale.body, fontSize: 17, color: colors.muted, textAlign: 'center' },
  controlsRow: { flexDirection: 'row', marginTop: 20 },
  bigButtonFilled: {
    flex: 1,
    minHeight: 64,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bigButtonFilledText: { fontSize: 21, fontWeight: '700', color: colors.white },
  disabled: { opacity: 0.45 },
  sectionHeader: { ...typeScale.sectionLabel, color: colors.ink, marginTop: 26 },
  mutedBody: { ...typeScale.body, color: colors.muted },
  mutedCaption: { ...typeScale.caption, color: colors.muted },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  historyDate: { ...typeScale.body, color: colors.ink, flex: 1 },
  historyDuration: { ...typeScale.bodyBold, color: colors.primary },
  historyDivider: { height: 1, backgroundColor: colors.divider },
  disclaimer: { ...typeScale.caption, color: colors.muted, marginTop: 18 },
});

export default ExerciseScreen;
