import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, THEME, GRADIENTS, SPACE, spacing, type as typeScale } from '../theme';
import { NAMES, HINTS } from '../core/exercises';
import { SensorsPanel } from '../components/SensorsPanel';

export interface RecordScreenProps {
  onSelect: (index: number) => void;
}

/** Lists the four fixed exercises, plus a plain statement of the brace/sensor situation.
 * Restyled onto the "Progress story" glass-card look (see Home) — same soft mint wash, same
 * translucent bordered cards — so Record reads as part of one app rather than a leftover
 * sensor-dashboard screen. */
export function RecordScreen({ onSelect }: RecordScreenProps) {
  return (
    <View style={styles.screen}>
      <LinearGradient colors={GRADIENTS.subtle} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Exercises</Text>
        <View style={THEME.glassCard}>
          {NAMES.map((name, i) => (
            <ExerciseRow
              key={name}
              name={name}
              hint={HINTS[i]}
              onPress={() => onSelect(i)}
              last={i === NAMES.length - 1}
            />
          ))}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: SPACE.stackMd }]}>Brace</Text>
        <Text style={styles.braceDetail}>
          Simulated data still drives the exercise timer above. Connect a real KneeSleeve here to
          see its live signal.
        </Text>
        <SensorsPanel />
      </ScrollView>
    </View>
  );
}

function ExerciseRow({ name, hint, onPress, last }: { name: string; hint: string; onPress: () => void; last: boolean }) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}. Opens the session screen with start, finish and save.`}
        style={styles.row}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{name}</Text>
          <Text style={styles.rowHint}>{hint}</Text>
        </View>
        <Text style={styles.chevron}>{'\u203A'}</Text>
      </Pressable>
      {!last && <View style={styles.rowDivider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTopMin,
    paddingBottom: spacing.screenBottom,
  },
  sectionLabel: { ...typeScale.sectionLabel, color: COLORS.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: 64,
  },
  rowDivider: { height: 1, backgroundColor: COLORS.divider },
  rowTitle: { ...typeScale.exerciseTitle, color: COLORS.text },
  rowHint: { ...typeScale.exerciseHint, color: COLORS.textSecondary, marginTop: 3 },
  chevron: { fontSize: 28, fontWeight: '700', color: COLORS.muted },
  braceCard: { padding: spacing.cardPadding },
  braceBody: { ...typeScale.body, color: COLORS.text },
  braceDetail: { ...typeScale.caption, color: COLORS.muted, marginTop: 6 },
});

export default RecordScreen;
