import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS, THEME, type as typeScale, radii, spacing } from '../theme';
import type { AsymmetryTrend, PersonalBest, Milestone } from '../core/progress';
import type { DayState } from '../core/types';
import { DONE, OPEN, MISSED } from '../core/types';
import { formatDuration } from './Journal';

/**
 * "Progress story" Home components. Structural pattern borrowed from Midnight Atlas
 * (glass cards, mono-uppercase stat labels, soft gradient backdrop) re-coloured onto
 * CareTech's white/green palette. See src/theme.ts for every token used here.
 */

function stamp(ms: number): string {
  const d = new Date(ms);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export function GlassCard({
  active = false,
  topMargin = 0,
  style,
  children,
}: {
  active?: boolean;
  topMargin?: number;
  style?: any;
  children?: React.ReactNode;
}) {
  return <View style={[active ? THEME.glassCardActive : THEME.glassCard, styles.cardPad, { marginTop: topMargin }, style]}>{children}</View>;
}

/** Small monospaced, uppercase, tracked tag — the one place this screen uses caps, for stat
 * chips/dates/units only (never for section titles, buttons or body copy). */
export function StatTag({ text, color = COLORS.textSecondary }: { text: string; color?: string }) {
  return <Text style={[THEME.statLabel, { color }]}>{text}</Text>;
}

/** Recovery-week hero: the one "active" glass card on the page. */
export function HeroCard({ week, summary }: { week: number; summary: string }) {
  return (
    <GlassCard active>
      <StatTag text={`Week ${week}`} color={COLORS.primary} />
      <Text style={styles.heroHeadline}>Week {week} of recovery</Text>
      <Text style={styles.heroSummary}>{summary}</Text>
    </GlassCard>
  );
}

/** Before any session is ever saved: explains what this page will show over time. */
export function EmptyState({ onGoToRecord }: { onGoToRecord: () => void }) {
  return (
    <GlassCard active>
      <StatTag text="Before you start" color={COLORS.primary} />
      <Text style={styles.heroHeadline}>Your recovery story starts here</Text>
      <Text style={styles.heroSummary}>
        Record your first exercise and this page will track your progress week by week: a
        recovery week count, how your left and right knee compare over time, a personal best for
        each exercise, and a timeline of milestones as you reach them.
      </Text>
      <Pressable
        onPress={onGoToRecord}
        accessibilityRole="button"
        accessibilityLabel="Record your first exercise. Opens the Record Exercise tab."
        style={styles.ctaButton}
      >
        <Text style={styles.ctaButtonText}>Record your first exercise</Text>
      </Pressable>
    </GlassCard>
  );
}

const DIRECTION_WORD: Record<string, string> = {
  improving: 'Improving',
  worse: 'Getting worse',
  steady: 'Steady',
};

function directionColor(direction: string): string {
  if (direction === 'improving') return COLORS.positive;
  if (direction === 'worse') return COLORS.warn;
  return COLORS.textSecondary;
}

/** Plain-language asymmetry trend with a small sparkline. Lower is better. */
export function AsymmetryTrendCard({ trend, topMargin = 0 }: { trend: AsymmetryTrend; topMargin?: number }) {
  if (trend.direction === 'unavailable' || trend.current == null || trend.reference == null) {
    return (
      <GlassCard topMargin={topMargin}>
        <Text style={styles.sectionLabel}>Knee asymmetry</Text>
        <Text style={styles.mutedBody}>No comparable recordings yet.</Text>
      </GlassCard>
    );
  }
  const color = directionColor(trend.direction);
  return (
    <GlassCard topMargin={topMargin}>
      <Text style={styles.sectionLabel}>Knee asymmetry</Text>
      <Text style={styles.trendLine}>
        Left/right gap: {trend.reference.toFixed(0)}% {'\u2192'} {trend.current.toFixed(0)}% this month
      </Text>
      <View style={styles.trendRow}>
        <Text style={[styles.trendDirection, { color }]}>{DIRECTION_WORD[trend.direction]}</Text>
        <Sparkline values={trend.sparkline} color={color} />
      </View>
      <Text style={styles.mutedCaption}>Lower is better.</Text>
    </GlassCard>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 96;
  const h = 28;
  if (!values || values.length < 2) return <View style={{ width: w, height: h }} />;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: pad + (i * (w - 2 * pad)) / (values.length - 1),
    y: h - pad - ((v - min) / span) * (h - 2 * pad),
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width={w} height={h}>
      <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={last.x} cy={last.y} r={2.8} fill={color} />
    </Svg>
  );
}

/** Personal best per exercise: best value, warm highlight colour, change since the first session. */
export function PersonalBestsCard({ bests, topMargin = 0 }: { bests: PersonalBest[]; topMargin?: number }) {
  return (
    <GlassCard topMargin={topMargin}>
      <Text style={styles.sectionLabel}>Personal bests</Text>
      {bests.map((b, i) => (
        <View key={b.key}>
          <View style={styles.pbRow}>
            <Text style={styles.pbName}>{b.name}</Text>
            {b.hasData ? (
              <View style={styles.pbValueCol}>
                <Text style={styles.pbValue}>{formatDuration(b.bestMs!)}</Text>
                {b.changeMs! > 0 ? (
                  <Text style={styles.pbChange}>{formatDuration(b.changeMs!)} faster than the first session</Text>
                ) : (
                  <Text style={styles.mutedCaption}>Set on the first session</Text>
                )}
              </View>
            ) : (
              <Text style={styles.mutedCaption}>Not recorded yet</Text>
            )}
          </View>
          {i < bests.length - 1 && <View style={styles.pbDivider} />}
        </View>
      ))}
    </GlassCard>
  );
}

/** Streak, kept small — supporting info, not the hero. */
export function StreakMiniCard({ streak, states7, topMargin = 0 }: { streak: number; states7: DayState[]; topMargin?: number }) {
  return (
    <GlassCard topMargin={topMargin}>
      <View style={styles.streakMiniRow}>
        <Text style={styles.streakMiniNumber}>{streak}</Text>
        <Text style={styles.streakMiniUnit}>day streak</Text>
      </View>
      <View style={styles.weekDotsRow}>
        {states7.map((s, i) => (
          <View
            key={i}
            style={[
              styles.weekDot,
              s === DONE && styles.weekDotDone,
              s === OPEN && styles.weekDotOpen,
              s === MISSED && styles.weekDotMissed,
            ]}
          />
        ))}
      </View>
    </GlassCard>
  );
}

/** Recent achievements, most recent first. */
export function MilestonesCard({ items, topMargin = 0 }: { items: Milestone[]; topMargin?: number }) {
  return (
    <GlassCard topMargin={topMargin}>
      <Text style={styles.sectionLabel}>Milestones</Text>
      {items.length === 0 ? (
        <Text style={styles.mutedBody}>Keep going — your first milestone will show up here.</Text>
      ) : (
        items.map((m, i) => (
          <View key={m.id}>
            <View style={styles.milestoneRow}>
              <View style={styles.milestoneDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.milestoneLabel}>{m.label}</Text>
                <Text style={styles.milestoneDetail}>
                  {m.detail} · {stamp(m.wallMs)}
                </Text>
              </View>
            </View>
            {i < items.length - 1 && <View style={styles.milestoneDivider} />}
          </View>
        ))
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  cardPad: { padding: spacing.cardPadding },
  heroHeadline: { ...typeScale.sectionLabel, fontSize: 24, color: COLORS.text, marginTop: 8 },
  heroSummary: { ...typeScale.body, color: COLORS.textSecondary, marginTop: 8, lineHeight: 21 },
  ctaButton: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: radii.button,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: { ...typeScale.body, fontSize: 16, fontWeight: '700', color: COLORS.textOnPrimary },
  sectionLabel: { ...typeScale.cardTitle, color: COLORS.text },
  mutedBody: { ...typeScale.body, color: COLORS.textSecondary, marginTop: 8 },
  mutedCaption: { ...typeScale.caption, color: COLORS.muted },
  trendLine: { ...typeScale.bodyBold, color: COLORS.text, marginTop: 10 },
  trendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  trendDirection: { ...typeScale.bodyBold, fontSize: 15 },
  pbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  pbName: { ...typeScale.body, color: COLORS.text, flex: 1 },
  pbValueCol: { alignItems: 'flex-end' },
  pbValue: { fontFamily: undefined, fontSize: 18, fontWeight: '700', color: COLORS.highlight },
  pbChange: { ...typeScale.small, color: COLORS.positive, marginTop: 2 },
  pbDivider: { height: 1, backgroundColor: COLORS.divider },
  streakMiniRow: { flexDirection: 'row', alignItems: 'flex-end' },
  streakMiniNumber: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  streakMiniUnit: { ...typeScale.caption, color: COLORS.muted, marginLeft: 6, marginBottom: 3 },
  weekDotsRow: { flexDirection: 'row', marginTop: 10 },
  weekDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginRight: 6,
    backgroundColor: 'transparent',
  },
  weekDotDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  weekDotOpen: { borderColor: COLORS.primary, borderWidth: 2 },
  weekDotMissed: { borderColor: COLORS.muted },
  milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
  milestoneDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6, marginRight: 12 },
  milestoneLabel: { ...typeScale.bodyBold, fontSize: 15, color: COLORS.text },
  milestoneDetail: { ...typeScale.caption, color: COLORS.muted, marginTop: 2 },
  milestoneDivider: { height: 1, backgroundColor: COLORS.divider, marginLeft: 20 },
});
