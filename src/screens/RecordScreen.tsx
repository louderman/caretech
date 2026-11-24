import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radii, borders, spacing, type as typeScale } from '../theme';
import { NAMES, HINTS } from '../core/exercises';

export interface RecordScreenProps {
  onSelect: (index: number) => void;
}

/** Lists the four fixed exercises, plus a plain statement of the brace/sensor situation. */
export function RecordScreen({ onSelect }: RecordScreenProps) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Exercises</Text>
      {NAMES.map((name, i) => (
        <ExerciseRow key={name} index={i} name={name} hint={HINTS[i]} onPress={() => onSelect(i)} />
      ))}

      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Brace</Text>
      <View style={styles.braceCard}>
        <Text style={styles.braceBody}>
          A simulated brace feeds this build's exercise timer so the Journal's charts can be
          previewed — no physical knee brace is connected yet.
        </Text>
        <Text style={styles.braceDetail}>
          Real brace recordings will only be added once the hardware and its replay/BLE protocol
          exist.
        </Text>
      </View>
    </ScrollView>
  );
}

function ExerciseRow({ name, hint, onPress }: { index: number; name: string; hint: string; onPress: () => void }) {
  return (
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
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTopMin,
    paddingBottom: spacing.screenBottom,
  },
  sectionLabel: { ...typeScale.sectionLabel, color: colors.ink },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.exerciseRow,
    borderWidth: borders.exerciseRow,
    borderColor: colors.divider,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
    marginTop: 10,
  },
  rowTitle: { ...typeScale.exerciseTitle, color: colors.ink },
  rowHint: { ...typeScale.exerciseHint, color: colors.muted, marginTop: 3 },
  chevron: { fontSize: 28, fontWeight: '700', color: colors.muted },
  braceCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
  },
  braceBody: { ...typeScale.body, color: colors.ink },
  braceDetail: { ...typeScale.caption, color: colors.muted, marginTop: 6 },
});

export default RecordScreen;
