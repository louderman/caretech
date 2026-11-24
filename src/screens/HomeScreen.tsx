import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, GRADIENTS, spacing } from '../theme';
import * as SessionStore from '../core/sessionStore';
import * as ObservationStore from '../core/observationStore';
import * as Streak from '../core/streak';
import * as BraceMetrics from '../core/braceMetrics';
import * as DebugFixture from '../core/debugFixture';
import * as Progress from '../core/progress';
import { KEYS } from '../core/exercises';
import type { Session } from '../core/types';
import { HeroCard, EmptyState, AsymmetryTrendCard, PersonalBestsCard, StreakMiniCard, MilestonesCard } from '../components/Progress';

/** How often Home re-renders to catch a local-day rollover, same cadence as Details/native. */
const DAY_POLL_MS = 15000;

export interface HomeScreenProps {
  onGoToRecord: () => void;
  /** Debug-only: shows the synthetic fixture instead of stored records (native EXTRA_FIXTURE). */
  debugFixture?: boolean;
}

/**
 * The "Progress story" home: a recovery-week hero, the asymmetry trend in plain language,
 * per-exercise personal bests, a small supporting streak card, and a milestones timeline.
 * Derivations live in src/core/progress.ts (pure, unit-tested); this screen only loads data
 * and renders it.
 */
export function HomeScreen({ onGoToRecord, debugFixture = false }: HomeScreenProps) {
  const [, setTick] = React.useState(0);
  const [saved, setSaved] = React.useState<Session[]>([]);
  const [byKey, setByKey] = React.useState<Record<string, Session[]>>({});
  const [points, setPoints] = React.useState<ReturnType<typeof BraceMetrics.sessions>>([]);

  const load = React.useCallback(async () => {
    const all = await SessionStore.all();
    setSaved(all);

    const map: Record<string, Session[]> = {};
    for (const k of KEYS) map[k] = await SessionStore.get(k);
    setByKey(map);

    const obs = debugFixture ? DebugFixture.observations() : await ObservationStore.all();
    setPoints(BraceMetrics.sessions(obs));
  }, [debugFixture]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), DAY_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  const week = Progress.weekOfRecovery(saved, now) ?? 1;
  const trend = Progress.asymmetryTrend(points, now);
  const bests = Progress.personalBests(byKey);
  const items = Progress.milestones(saved, byKey, points);
  const streak = Streak.current(saved, now);
  const states7 = Streak.states(saved, now, undefined, 7);
  const summary = summaryLine(bests, trend);

  return (
    <View style={styles.screen}>
      <LinearGradient colors={GRADIENTS.home} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {saved.length === 0 ? (
          <EmptyState onGoToRecord={onGoToRecord} />
        ) : (
          <>
            <HeroCard week={week} summary={summary} />
            <AsymmetryTrendCard trend={trend} topMargin={spacing.cardGap} />
            <PersonalBestsCard bests={bests} topMargin={spacing.cardGap} />
            <StreakMiniCard streak={streak} states7={states7} topMargin={spacing.cardGap} />
            <MilestonesCard items={items} topMargin={spacing.cardGap} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function summaryLine(bests: Progress.PersonalBest[], trend: Progress.AsymmetryTrend): string {
  const improvedAny = bests.some((b) => b.hasData && (b.changeMs ?? 0) > 0);
  if (trend.direction === 'improving' || improvedAny) return "You're moving better than when you started.";
  if (trend.direction === 'worse') return 'Your left/right gap widened recently — worth a look.';
  return 'Steady so far. Keep logging sessions to build your trend.';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTopMin,
    paddingBottom: spacing.screenBottom,
  },
});

export default HomeScreen;
