import React from 'react';
import { View, Text as RNText, StyleSheet } from 'react-native';
import Svg, { Line, Path, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

/**
 * A plain multi-series line chart with labelled axes, ported visually from the native
 * LineChartView.java. Deliberately utilitarian: no fills, no gradients, no gridlines beyond a
 * light frame and value ticks. Each series draws only between consecutive points that both have
 * a value, so a missing value is a visible *gap* — nothing is interpolated across it. NaN means
 * "unavailable" for a point.
 *
 * Two non-colour cues are available per series — a dashed stroke and square markers — so a pair
 * of series is still readable without relying on hue alone.
 */

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
  /** Dashed stroke instead of a solid one. */
  dashed?: boolean;
  /** Square markers instead of rings. */
  squareMarkers?: boolean;
}

export interface LineChartProps {
  yTitle?: string;
  decimals?: number;
  emptyText?: string;
  xLabels: string[];
  series: ChartSeries[];
  /** With this set, a chart whose plotted values are all non-negative never renders a negative floor. */
  zeroFloor?: boolean;
  height?: number;
}

const AXIS = colors.axis;
const TICK = colors.tick;

export function LineChart({
  yTitle = '',
  decimals = 0,
  emptyText = 'Unavailable',
  xLabels,
  series,
  zeroFloor = false,
  height = 180,
}: LineChartProps) {
  const [width, setWidth] = React.useState(300);

  const padTop = 10;
  const padBottom = 22;
  const padLeft = 46;
  const padRight = 12;
  const plotL = padLeft;
  const plotR = width - padRight;
  const plotT = padTop;
  const plotB = height - padBottom;

  let min = Infinity;
  let max = -Infinity;
  let n = 0;
  for (const s of series) {
    n = Math.max(n, s.values?.length ?? 0);
    for (const v of s.values ?? []) {
      if (Number.isNaN(v) || !Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const empty = n === 0 || min === Infinity;
  let dataMin = min;
  let plotMin = min;
  let plotMax = max;
  if (!empty) {
    if (max === min) plotMax = min + 1;
    const span = plotMax - plotMin;
    plotMin = plotMin - span * 0.08;
    plotMax = plotMax + span * 0.08;
    if (zeroFloor && dataMin >= 0 && plotMin < 0) plotMin = 0;
  }

  const xAt = (i: number) => (n <= 1 ? (plotL + plotR) / 2 : plotL + ((plotR - plotL) * i) / (n - 1));
  const yAt = (v: number) => plotB - ((v - plotMin) / (plotMax - plotMin)) * (plotB - plotT);
  const fmt = (v: number) => v.toFixed(decimals);

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <Svg width={width} height={height}>
        <Rect x={plotL} y={plotT} width={plotR - plotL} height={plotB - plotT} fill="none" stroke={AXIS} strokeWidth={1} />
        {empty ? (
          <SvgText x={(plotL + plotR) / 2} y={(plotT + plotB) / 2 + 5} fontSize={13} fill={colors.muted} textAnchor="middle">
            {emptyText}
          </SvgText>
        ) : (
          <>
            {[0, 1, 2].map((i) => {
              const v = plotMin + ((plotMax - plotMin) * i) / 2;
              const y = yAt(v);
              return (
                <React.Fragment key={i}>
                  <Line x1={plotL - 4} y1={y} x2={plotL} y2={y} stroke={AXIS} strokeWidth={1} />
                  <SvgText x={plotL - 6} y={y + 4} fontSize={11} fill={TICK} textAnchor="end">
                    {fmt(v)}
                  </SvgText>
                </React.Fragment>
              );
            })}
            {!!yTitle && (
              <SvgText x={plotL} y={plotT - 1} fontSize={11} fill={TICK} textAnchor="start">
                {yTitle}
              </SvgText>
            )}
            {xLabels[0] ? (
              <SvgText x={plotL} y={height - 8} fontSize={11} fill={TICK} textAnchor="start">
                {xLabels[0]}
              </SvgText>
            ) : null}
            {n > 1 && xLabels[n - 1] ? (
              <SvgText x={plotR} y={height - 8} fontSize={11} fill={TICK} textAnchor="end">
                {xLabels[n - 1]}
              </SvgText>
            ) : null}
            {series.map((s, si) => {
              if (!s.values || s.values.length === 0) return null;
              const segments: { x: number; y: number }[][] = [];
              let current: { x: number; y: number }[] = [];
              const points: { x: number; y: number }[] = [];
              for (let i = 0; i < s.values.length; i++) {
                const v = s.values[i];
                if (Number.isNaN(v) || !Number.isFinite(v)) {
                  if (current.length) segments.push(current);
                  current = [];
                  continue;
                }
                const pt = { x: xAt(i), y: yAt(v) };
                current.push(pt);
                points.push(pt);
              }
              if (current.length) segments.push(current);
              const dash = s.dashed ? '5,4' : undefined;
              return (
                <React.Fragment key={si}>
                  {segments.map((seg, segi) => (
                    <Path
                      key={segi}
                      d={seg.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                      stroke={s.color}
                      strokeWidth={2}
                      strokeDasharray={dash}
                      strokeLinecap="round"
                      fill="none"
                    />
                  ))}
                  {points.map((p, i) =>
                    s.squareMarkers ? (
                      <Rect key={i} x={p.x - 2.6} y={p.y - 2.6} width={5.2} height={5.2} fill={s.color} />
                    ) : (
                      <Circle key={i} cx={p.x} cy={p.y} r={2.6} fill={s.color} />
                    ),
                  )}
                </React.Fragment>
              );
            })}
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});

export default LineChart;
