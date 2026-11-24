import React from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme';
import { JournalScreen, type Highlight, HIGHLIGHT_MS } from './src/screens/JournalScreen';
import { RecordScreen } from './src/screens/RecordScreen';
import { ExerciseScreen } from './src/screens/ExerciseScreen';

type Tab = 'journal' | 'record';

/**
 * App shell: a persistent two-tab bar (Journal / Record Exercise), ported from the native
 * MainActivity. Picking an exercise pushes a full-screen ExerciseScreen over the tabs — the same
 * relationship ExerciseActivity has to MainActivity — rather than adding a third tab.
 */
/**
 * Debug-only: on web, `?fixture=1` shows the DebugFixture synthetic dataset instead of the
 * real (empty on first launch) ObservationStore, so the full Journal — sessions, asymmetry
 * chart, sensor readings — can be reviewed and screenshotted without a real brace. Never
 * reachable on native and never touches real stored data.
 */
function useDebugFixtureFromUrl(): boolean {
  return React.useMemo(() => {
    if (typeof window === 'undefined' || typeof window.location === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).get('fixture') === '1';
    } catch {
      return false;
    }
  }, []);
}

export default function App() {
  const [tab, setTab] = React.useState<Tab>('journal');
  const [exerciseIndex, setExerciseIndex] = React.useState<number | null>(null);
  const [highlight, setHighlight] = React.useState<Highlight | null>(null);
  const debugFixture = useDebugFixtureFromUrl();

  if (exerciseIndex != null) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ExerciseScreen
          index={exerciseIndex}
          onBackToJournal={({ key, startWallMs }) => {
            setHighlight({ key, startWallMs, untilMs: Date.now() + HIGHLIGHT_MS });
            setExerciseIndex(null);
            setTab('journal');
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {tab === 'journal' ? (
          <JournalScreen onGoToRecord={() => setTab('record')} highlight={highlight} debugFixture={debugFixture} />
        ) : (
          <RecordScreen onSelect={(i) => setExerciseIndex(i)} />
        )}
      </View>
      <View style={styles.divider} />
      <View style={styles.tabBar}>
        <TabButton label="Journal" active={tab === 'journal'} onPress={() => setTab('journal')} />
        <TabButton label="Record Exercise" active={tab === 'record'} onPress={() => setTab('record')} />
      </View>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.tabButton} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.muted, fontWeight: active ? '700' : '400' }]}>
        {label}
      </Text>
      <View style={[styles.underline, { backgroundColor: active ? colors.primary : 'transparent' }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.divider },
  tabBar: { flexDirection: 'row', backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 6 },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  tabLabel: { fontSize: 17 },
  underline: { width: '100%', height: 3, marginTop: 6, borderRadius: 1.5 },
});
