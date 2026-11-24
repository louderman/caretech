import React from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { colors, FONTS, FONT_ASSETS } from './src/theme';
import { HomeScreen } from './src/screens/HomeScreen';
import { DetailsScreen, type Highlight, HIGHLIGHT_MS } from './src/screens/DetailsScreen';
import { RecordScreen } from './src/screens/RecordScreen';
import { ExerciseScreen } from './src/screens/ExerciseScreen';

type Tab = 'home' | 'details' | 'record';

/**
 * App shell: a persistent three-tab bar (Home / Details / Record Exercise), ported from the
 * native MainActivity and extended with the "Progress story" Home. Picking an exercise pushes a
 * full-screen ExerciseScreen over the tabs — the same relationship ExerciseActivity has to
 * MainActivity — rather than adding a fourth tab. Finishing a session returns to Details with
 * that row highlighted, same as the native "Back to Journal" behaviour.
 */
/**
 * Debug-only: on web, `?fixture=1` shows the DebugFixture synthetic dataset instead of the
 * real (empty on first launch) ObservationStore, so Home and Details can be reviewed and
 * screenshotted without a real brace. Never reachable on native and never touches real data.
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
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  const [tab, setTab] = React.useState<Tab>('home');
  const [exerciseIndex, setExerciseIndex] = React.useState<number | null>(null);
  const [highlight, setHighlight] = React.useState<Highlight | null>(null);
  const debugFixture = useDebugFixtureFromUrl();

  if (!fontsLoaded) {
    return <View style={styles.safe} />;
  }

  if (exerciseIndex != null) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ExerciseScreen
          index={exerciseIndex}
          onBackToJournal={({ key, startWallMs }) => {
            setHighlight({ key, startWallMs, untilMs: Date.now() + HIGHLIGHT_MS });
            setExerciseIndex(null);
            setTab('details');
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {tab === 'home' && <HomeScreen onGoToRecord={() => setTab('record')} debugFixture={debugFixture} />}
        {tab === 'details' && <DetailsScreen highlight={highlight} debugFixture={debugFixture} />}
        {tab === 'record' && <RecordScreen onSelect={(i) => setExerciseIndex(i)} />}
      </View>
      <View style={styles.divider} />
      <View style={styles.tabBar}>
        <TabButton label="Home" active={tab === 'home'} onPress={() => setTab('home')} />
        <TabButton label="Details" active={tab === 'details'} onPress={() => setTab('details')} />
        <TabButton label="Record exercise" active={tab === 'record'} onPress={() => setTab('record')} />
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
  tabLabel: { fontSize: 15, fontFamily: FONTS.body },
  underline: { width: '100%', height: 3, marginTop: 6, borderRadius: 1.5 },
});
