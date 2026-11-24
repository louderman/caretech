import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
import * as SessionStore from '../core/sessionStore';
import * as ObservationStore from '../core/observationStore';
import * as BraceMetrics from '../core/braceMetrics';
import * as ChartLabels from '../core/chartLabels';
import * as DebugFixture from '../core/debugFixture';
import { KEYS, NAMES } from '../core/exercises';
import type { Session } from '../core/types';
import {
  SessionsCard,
  AsymmetryCard,
  ReadingsCard,
  CompletedCard,
  EmptyChartRow,
  DebugBanner,
  type SessionRowData,
} from '../components/Journal';

/** How long the just-saved session row stays marked after "Back to Details" (native: HIGHLIGHT_MS). */
export const HIGHLIGHT_MS = 20000;

export interface Highlight {
  key: string;
  startWallMs: number;
  untilMs: number;
}

export interface DetailsScreenProps {
  highlight?: Highlight | null;
  /** Debug-only: shows the synthetic fixture instead of stored records (native EXTRA_FIXTURE). Never wired to any UI control. */
  debugFixture?: boolean;
}

/**
 * The exact-port Journal content — sessions list, knee asymmetry chart, sensor L/R readings,
 * today's completed-exercises card — now living behind its own tab. The recovery-week hero,
 * streak and Last-7-days strip moved to the new "Progress story" Home; everything else here is
 * unchanged from the original JournalScreen.
 */
export function DetailsScreen({ highlight, debugFixture = false }: DetailsScreenProps) {
  const [rows, setRows] = React.useState<SessionRowData[]>([]);
  const [points, setPoints] = React.useState<ReturnType<typeof BraceMetrics.sessions>>([]);

  const load = React.useCallback(async () => {
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

  const now = Date.now();
  const labels = ChartLabels.forSessions(points);
  const hasAsymmetry = points.some((p) => !Number.isNaN(p.asymmetry));
  const hasReadings = points.some((p) => !Number.isNaN(p.leftMean) || !Number.isNaN(p.rightMean));
  const charted = hasAsymmetry || hasReadings;
  const completedRows = NAMES.map((name, i) => ({
    name,
    done: rows.some((r) => r.key === KEYS[i] && SessionStore.isSameLocalDay(r.finishWallMs, now)),
  }));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {debugFixture && <DebugBanner />}

      {hasAsymmetry && <AsymmetryCard points={points} labels={labels} />}
      {hasReadings && <ReadingsCard points={points} labels={labels} topMargin={hasAsymmetry ? spacing.cardGap : 0} />}

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

export default DetailsScreen;
