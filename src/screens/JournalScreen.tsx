import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import * as SessionStore from '../core/sessionStore';
import * as ObservationStore from '../core/observationStore';
import * as Streak from '../core/streak';
import * as BraceMetrics from '../core/braceMetrics';
import * as ChartLabels from '../core/chartLabels';
import * as DebugFixture from '../core/debugFixture';
import { KEYS, NAMES } from '../core/exercises';
import type { Session } from '../core/types';
import {
  RecordCta,
  StreakCard,
  WeekStripCard,
  SessionsCard,
  AsymmetryCard,
  ReadingsCard,
  CompletedCard,
  EmptyChartRow,
  DebugBanner,
  type SessionRowData,
} from '../components/Journal';

/** How long the just-saved session row stays marked after "Back to Journal" (native: HIGHLIGHT_MS). */
export const HIGHLIGHT_MS = 20000;
/** How often the Journal re-renders to catch a local-day rollover (native: DAY_POLL_MS). */
const DAY_POLL_MS = 15000;

export interface Highlight {
  key: string;
  startWallMs: number;
  untilMs: number;
}

export interface JournalScreenProps {
  onGoToRecord: () => void;
  highlight?: Highlight | null;
  /** Debug-only: shows the synthetic fixture instead of stored records (native EXTRA_FIXTURE). Never wired to any UI control. */
  debugFixture?: boolean;
}

export function JournalScreen({ onGoToRecord, highlight, debugFixture = false }: JournalScreenProps) {
  const [, setTick] = React.useState(0);
  const [saved, setSaved] = React.useState<Session[]>([]);
  const [rows, setRows] = React.useState<SessionRowData[]>([]);
  const [points, setPoints] = React.useState<ReturnType<typeof BraceMetrics.sessions>>([]);

  const load = React.useCallback(async () => {
    const all = await SessionStore.all();
    setSaved(all);

    const sessionRows: SessionRowData[] = [];
    for (let i = 0; i < KEYS.length; i++) {
      for (const s of await SessionStore.get(KEYS[i])) {
        sessionRows.push({
          name: NAMES[i],
          key: KEYS[i],
          startWallMs: s.startWallMs,
          durationMs: s.durationMs,
          finishWallMs: s.finishWallMs,
          highlighted:
            !!highlight &&
            Date.now() < highlight.untilMs &&
            highlight.key === KEYS[i] &&
            highlight.startWallMs === s.startWallMs,
        });
      }
    }
    sessionRows.sort((a, b) => (b.startWallMs !== a.startWallMs ? b.startWallMs - a.startWallMs : a.name.localeCompare(b.name)));
    setRows(sessionRows);

    const obs = debugFixture ? DebugFixture.observations() : await ObservationStore.all();
    setPoints(BraceMetrics.sessions(obs));
  }, [highlight, debugFixture]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Re-render periodically so a local-day rollover (midnight) is caught while the screen is open,
  // same cadence as the native Journal's day-change poll.
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), DAY_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const streak = Streak.current(saved, now);
  const last = Streak.lastFinishMs(saved);
  const lastSavedLine = (() => {
    if (last < 0) return '';
    const today = Streak.localDay(last) === Streak.localDay(now);
    if (today) {
      const d = new Date(last);
      return `Last saved: today, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(last);
    return `Last saved: ${d.getDate()} ${months[d.getMonth()]}`;
  })();
  const states30 = Streak.states(saved, now, undefined, 30);
  const starts7 = Streak.dayStarts(now, 7);
  const states7 = Streak.states(saved, now, undefined, 7);

  const labels = ChartLabels.forSessions(points);
  const hasAsymmetry = points.some((p) => !Number.isNaN(p.asymmetry));
  const hasReadings = points.some((p) => !Number.isNaN(p.leftMean) || !Number.isNaN(p.rightMean));
  const charted = hasAsymmetry || hasReadings;
  const anySessionRecorded = saved.length > 0;
  const completedRows = NAMES.map((name, i) => ({
    name,
    done: rows.some((r) => r.key === KEYS[i] && SessionStore.isSameLocalDay(r.finishWallMs, now)),
  }));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {debugFixture && <DebugBanner />}

      {!anySessionRecorded && <RecordCta onPress={onGoToRecord} />}

      {saved.length > 0 && (
        <>
          <StreakCard streak={streak} lastSavedLine={lastSavedLine} states30={states30} />
          <WeekStripCard starts={starts7} states={states7} topMargin={16} />
        </>
      )}

      {hasAsymmetry && <AsymmetryCard points={points} labels={labels} topMargin={16} />}
      {hasReadings && <ReadingsCard points={points} labels={labels} topMargin={16} />}

      <SessionsCard rows={rows} />

      {(() => {
        let gap: number = charted ? spacing.cardGap : spacing.cardGapNoCharts;
        const nodes: React.ReactNode[] = [];
        if (!hasAsymmetry) {
          nodes.push(<EmptyChartRow key="asym" title="Knee asymmetry" status="no matched recordings yet" topMargin={gap} />);
          gap = 6;
        }
        if (!hasReadings) {
          nodes.push(<EmptyChartRow key="read" title="Sensor readings" status="no brace recordings yet" topMargin={gap} />);
        }
        return nodes;
      })()}

      <CompletedCard rows={completedRows} topMargin={24} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTopMin,
    paddingBottom: spacing.screenBottom,
  },
});

export default JournalScreen;
