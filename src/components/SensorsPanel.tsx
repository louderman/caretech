import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { COLORS, THEME, SPACE, spacing, type as typeScale } from '../theme';
import { LineChart } from './LineChart';
import {
  createDefaultKneeSleeveSource,
  createSimulatedKneeSleeveSource,
  type KneeSleeveSide,
  type KneeSleeveSource,
  type KneeSleeveStatus,
} from '../core/kneeSleeveSource';

const HISTORY_POINTS = 50;
const RENDER_THROTTLE_MS = 250;
const SIDES: KneeSleeveSide[] = ['L', 'R'];
const SIDE_LABEL: Record<KneeSleeveSide, string> = { L: 'Left', R: 'Right' };

function idleStatus(side: KneeSleeveSide): KneeSleeveStatus {
  return { side, state: 'idle', packetsReceived: 0, packetsDropped: 0 };
}

function formatAge(nowMs: number, lastMs?: number): string {
  if (lastMs == null) return 'no packets yet';
  const s = (nowMs - lastMs) / 1000;
  if (s < 1.5) return 'just now';
  if (s < 60) return `${s.toFixed(1)}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function stateLabel(state: KneeSleeveStatus['state']): string {
  switch (state) {
    case 'idle':
      return 'Not connected';
    case 'scanning':
      return 'Scanning…';
    case 'connecting':
      return 'Connecting…';
    case 'connected':
      return 'Connected';
    case 'disconnected':
      return 'Disconnected';
    case 'unavailable':
      return 'Bluetooth unavailable';
    case 'error':
    default:
      return 'Error';
  }
}

/**
 * Minimal live BLE panel for the real KneeSleeve brace(s). Connect left / Connect right each
 * independently scan+connect to one physical device and remember it by BLE device ID for next
 * time (see kneeSleeveSourceShared.ts — the firmware has no side field of its own).
 *
 * Demo mode swaps in SimulatedKneeSleeveSource so both sides can be shown graphing without any
 * hardware present, for screenshots and for days the brace isn't on hand.
 */
export function SensorsPanel() {
  const [demoMode, setDemoMode] = useState(false);
  const [status, setStatus] = useState<Record<KneeSleeveSide, KneeSleeveStatus>>({
    L: idleStatus('L'),
    R: idleStatus('R'),
  });
  const [, forceRender] = useState(0);
  const [now, setNow] = useState(Date.now());

  const sourceRef = useRef<KneeSleeveSource | null>(null);
  const sourceIsDemoRef = useRef(false);
  const seriesRef = useRef<Record<KneeSleeveSide, { a: number[]; b: number[] }>>({
    L: { a: [], b: [] },
    R: { a: [], b: [] },
  });
  const lastRenderRef = useRef(0);
  const anyConnected = status.L.state === 'connected' || status.R.state === 'connected' ||
    status.L.state === 'scanning' || status.R.state === 'scanning' || status.L.state === 'connecting' || status.R.state === 'connecting';

  const getSource = useCallback((): KneeSleeveSource => {
    if (sourceRef.current && sourceIsDemoRef.current === demoMode) return sourceRef.current;
    sourceRef.current = demoMode ? createSimulatedKneeSleeveSource() : createDefaultKneeSleeveSource();
    sourceIsDemoRef.current = demoMode;
    return sourceRef.current;
  }, [demoMode]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      sourceRef.current?.disconnectAll();
    };
  }, []);

  const handleConnect = useCallback(
    (side: KneeSleeveSide) => {
      const source = getSource();
      seriesRef.current[side] = { a: [], b: [] };
      source
        .connect(
          side,
          (s, _sample, reading) => {
            const buf = seriesRef.current[s];
            buf.a.push(reading.ohmsA ?? NaN);
            buf.b.push(reading.ohmsB ?? NaN);
            if (buf.a.length > HISTORY_POINTS) buf.a.shift();
            if (buf.b.length > HISTORY_POINTS) buf.b.shift();
            const nowMs = Date.now();
            if (nowMs - lastRenderRef.current > RENDER_THROTTLE_MS) {
              lastRenderRef.current = nowMs;
              forceRender((n) => n + 1);
            }
          },
          (newStatus) => {
            setStatus((prev) => ({ ...prev, [newStatus.side]: newStatus }));
          },
        )
        .catch((err) => {
          // onStatus already reported the error state; this just prevents an unhandled rejection.
          console.warn('KneeSleeve connect failed', side, err);
        });
    },
    [getSource],
  );

  const handleDisconnect = useCallback(
    (side: KneeSleeveSide) => {
      sourceRef.current?.disconnect(side);
      setStatus((prev) => ({ ...prev, [side]: idleStatus(side) }));
      seriesRef.current[side] = { a: [], b: [] };
    },
    [],
  );

  const xLabels = useMemo(() => Array.from({ length: HISTORY_POINTS }, () => ''), []);

  return (
    <View>
      <View style={styles.demoRow}>
        <Text style={styles.demoLabel}>Demo mode (simulated, no hardware)</Text>
        <Switch
          value={demoMode}
          onValueChange={(v) => {
            if (anyConnected) return; // avoid swapping sources mid-connection
            setDemoMode(v);
          }}
          disabled={anyConnected}
        />
      </View>

      {SIDES.map((side) => {
        const st = status[side];
        const series = seriesRef.current[side];
        const connected = st.state === 'connected';
        const busy = st.state === 'scanning' || st.state === 'connecting';
        return (
          <View key={side} style={styles.sideCard}>
            <View style={styles.sideHeader}>
              <Text style={styles.sideTitle}>{SIDE_LABEL[side]}</Text>
              <Pressable
                onPress={() => (connected || busy ? handleDisconnect(side) : handleConnect(side))}
                style={[styles.connectBtn, (connected || busy) && styles.connectBtnActive]}
                accessibilityRole="button"
                accessibilityLabel={`${connected || busy ? 'Disconnect' : 'Connect'} ${SIDE_LABEL[side]} KneeSleeve`}
              >
                <Text style={[styles.connectBtnText, (connected || busy) && styles.connectBtnTextActive]}>
                  {busy ? 'Cancel' : connected ? 'Disconnect' : 'Connect'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.statusLine}>
              {stateLabel(st.state)}
              {st.deviceName ? ` · ${st.deviceName}` : ''}
            </Text>
            <Text style={styles.statusDetail}>
              {formatAge(now, st.lastPacketAtMs)} · {st.packetsReceived} packets · {st.packetsDropped} dropped
            </Text>
            {st.lastError ? <Text style={styles.errorLine}>{st.lastError}</Text> : null}

            <LineChart
              yTitle="Ω"
              decimals={0}
              emptyText={connected ? 'Waiting for packets…' : 'Not connected'}
              xLabels={xLabels}
              zeroFloor
              height={140}
              series={[
                { name: 'Sensor A', color: COLORS.primary, values: series.a },
                { name: 'Sensor B', color: COLORS.warn, values: series.b, dashed: true, squareMarkers: true },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.stackSm,
  },
  demoLabel: { ...typeScale.caption, color: COLORS.textSecondary, flex: 1, marginRight: SPACE.stackSm },
  sideCard: {
    ...THEME.glassCard,
    padding: spacing.cardPadding,
    marginBottom: SPACE.stackSm,
  },
  sideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideTitle: { ...typeScale.exerciseTitle, color: COLORS.text },
  connectBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  connectBtnActive: { backgroundColor: COLORS.primary },
  connectBtnText: { ...typeScale.caption, color: COLORS.primary, fontWeight: '700' },
  connectBtnTextActive: { color: COLORS.textOnPrimary },
  statusLine: { ...typeScale.body, color: COLORS.text, marginTop: 8 },
  statusDetail: { ...typeScale.caption, color: COLORS.muted, marginTop: 2 },
  errorLine: { ...typeScale.caption, color: COLORS.error, marginTop: 2 },
});

export default SensorsPanel;
