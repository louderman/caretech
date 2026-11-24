/** Ported from CareTechTests.java: chartAxisLabelsStayDistinct. */
import * as ChartLabels from '../src/core/chartLabels';
import type { SessionPoint } from '../src/core/types';

function point(id: string, wallMs: number): SessionPoint {
  return { sessionId: id, wallMs, leftMean: 1000.0, rightMean: 1100.0, asymmetry: 9.5, leftRom: NaN, rightRom: NaN };
}

describe('ChartLabels.forSessions', () => {
  test('same-day sessions carry the clock time so ticks differ; a lone day stays day-only', () => {
    const t0 = 1800000000000;
    const secondSameDay = t0 + 3600000;
    const thirdSameDay = t0 + 7200000;
    const nextDay = t0 + 86400000;
    const pts = [point('a', thirdSameDay), point('b', secondSameDay), point('c', nextDay)];
    const labels = ChartLabels.forSessions(pts);
    expect(labels).toHaveLength(3);
    expect(labels[0]).toBe(`${ChartLabels.day(thirdSameDay)} ${ChartLabels.time(thirdSameDay)}`);
    expect(labels[1]).toBe(`${ChartLabels.day(secondSameDay)} ${ChartLabels.time(secondSameDay)}`);
    expect(labels[2]).toBe(ChartLabels.day(nextDay));
    expect(labels[0]).not.toBe(labels[1]);
    expect(labels[1]).not.toBe(labels[2]);
  });

  test('empty and null session lists yield no labels', () => {
    expect(ChartLabels.forSessions([])).toHaveLength(0);
    expect(ChartLabels.forSessions(null)).toHaveLength(0);
  });
});
