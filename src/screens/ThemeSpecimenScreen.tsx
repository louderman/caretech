import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, THEME, GRADIENTS, FONTS, SPACE, spacing, type as typeScale } from '../theme';

/**
 * Debug-only (`?screen=specimen` on web, see App.tsx): the "Progress story" theme in isolation —
 * type scale, colour roles, gradient wash and both glass-card variants — so the look can be
 * judged separately from any screen's layout. Never reachable on native, never wired to any UI
 * control.
 */
export function ThemeSpecimenScreen() {
  return (
    <View style={styles.screen}>
      <LinearGradient colors={GRADIENTS.home} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={THEME.statLabel}>Theme specimen</Text>
        <Text style={[styles.display, { fontFamily: FONTS.display }]}>Progress story</Text>
        <Text style={[styles.headline, { fontFamily: FONTS.heading }]}>Week 6 of recovery</Text>
        <Text style={[styles.body, { fontFamily: FONTS.body }]}>
          White-and-green surfaces, soft mint gradients and glass cards — the structural pattern
          borrowed from Midnight Atlas, re-coloured for CareTech.
        </Text>

        <Section title="Type roles">
          <Row label="Sora 800 — display" sample="Week 6" font={FONTS.display} size={32} />
          <Row label="Sora 700 — headline" sample="Knee asymmetry" font={FONTS.heading} size={22} />
          <Row label="Plus Jakarta 400 — body" sample="Lower is better." font={FONTS.body} size={16} />
          <Row label="Plus Jakarta 600 — body semibold" sample="Record your first exercise" font={FONTS.bodySemiBold} size={16} />
          <Row label="JetBrains Mono 600 — stat label" sample="WEEK 6 · 12% → 6%" font={FONTS.mono} size={13} mono />
          <Row label="JetBrains Mono 700 — stat value" sample="4 DAY STREAK" font={FONTS.monoBold} size={16} mono />
        </Section>

        <Section title="Colour roles">
          <Swatch name="background" color={COLORS.background} />
          <Swatch name="surface" color={COLORS.surface} />
          <Swatch name="primary (health green)" color={COLORS.primary} light />
          <Swatch name="primaryDim" color={COLORS.primaryDim} light />
          <Swatch name="mint (positive / improving)" color={COLORS.mint} />
          <Swatch name="highlight (personal bests)" color={COLORS.highlight} light />
          <Swatch name="warn (trend worse)" color={COLORS.warn} light />
          <Swatch name="text" color={COLORS.text} light />
          <Swatch name="textSecondary" color={COLORS.textSecondary} light />
        </Section>

        <Section title="Cards">
          <View style={THEME.glassCard}>
            <View style={{ padding: spacing.cardPadding }}>
              <Text style={THEME.statLabel}>Glass card</Text>
              <Text style={[styles.cardTitle]}>Default state</Text>
              <Text style={styles.cardBody}>1px border at ~18% opacity, radius 14, soft shadow.</Text>
            </View>
          </View>
          <View style={[THEME.glassCardActive, { marginTop: SPACE.stackSm }]}>
            <View style={{ padding: spacing.cardPadding }}>
              <Text style={[THEME.statLabel, { color: COLORS.primary }]}>Glass card — active</Text>
              <Text style={styles.cardTitle}>Hero / selected variant</Text>
              <Text style={styles.cardBody}>Mint-tinted fill, brighter border, deeper shadow.</Text>
            </View>
          </View>
        </Section>

        <Section title="Gradients">
          <GradientSwatch name="home" colors={GRADIENTS.home} />
          <GradientSwatch name="subtle" colors={GRADIENTS.subtle} />
        </Section>

        <Section title="Spacing (4px unit)">
          <Text style={styles.cardBody}>
            unit {SPACE.unit} · gutter {SPACE.gutter} · margin {SPACE.marginMobile} · stack{' '}
            {SPACE.stackSm}/{SPACE.stackMd}/{SPACE.stackLg}
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: SPACE.stackMd }}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={{ marginTop: SPACE.stackSm }}>{children}</View>
    </View>
  );
}

function Row({ label, sample, font, size, mono = false }: { label: string; sample: string; font: string; size: number; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={{
          fontFamily: font,
          fontSize: size,
          color: COLORS.text,
          textTransform: mono ? 'uppercase' : 'none',
          letterSpacing: mono ? 1 : 0,
        }}
      >
        {sample}
      </Text>
    </View>
  );
}

function Swatch({ name, color, light = false }: { name: string; color: string; light?: boolean }) {
  return (
    <View style={styles.swatchRow}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.swatchLabel}>
        {name} <Text style={styles.swatchHex}>{color}</Text>
      </Text>
    </View>
  );
}

function GradientSwatch({ name, colors }: { name: string; colors: readonly string[] }) {
  return (
    <View style={styles.gradientRow}>
      <LinearGradient colors={colors as any} style={styles.gradientBox} />
      <Text style={styles.swatchLabel}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.screenTopMin, paddingBottom: spacing.screenBottom },
  display: { fontSize: 36, color: COLORS.text, marginTop: 8 },
  headline: { fontSize: 24, color: COLORS.text, marginTop: 8 },
  body: { ...typeScale.body, color: COLORS.textSecondary, marginTop: 8, lineHeight: 21 },
  sectionLabel: { ...typeScale.sectionLabel, color: COLORS.text },
  cardTitle: { ...typeScale.cardTitle, color: COLORS.text, marginTop: 6 },
  cardBody: { ...typeScale.body, color: COLORS.textSecondary, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  rowLabel: { ...typeScale.caption, color: COLORS.muted, flex: 1 },
  swatchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  swatch: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: COLORS.divider, marginRight: 12 },
  swatchLabel: { ...typeScale.body, color: COLORS.text },
  swatchHex: { ...typeScale.caption, color: COLORS.muted },
  gradientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  gradientBox: { width: 96, height: 40, borderRadius: 8, borderWidth: 1, borderColor: COLORS.divider, marginRight: 12 },
});

export default ThemeSpecimenScreen;
