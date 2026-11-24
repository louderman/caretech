/** Ported from CareTechTests.java: codecRoundTrip, legacyLineStillUsable, malformedLineSkipped. */
import * as BraceCodec from '../src/core/braceCodec';
import { isLeft, isCalibrated } from '../src/core/types';
import { UNIT_ADC_COUNTS, UNCALIBRATED } from '../src/core/types';

describe('BraceCodec', () => {
  test('round trip keeps every field', () => {
    const o = {
      wallMs: 1795000000000,
      sessionId: 's1',
      sessionKey: 'walk',
      side: 'R' as const,
      provenance: 'replay',
      unit: UNIT_ADC_COUNTS,
      calibration: 'cal-a',
      raw: [1, 2, 3],
      angles: [10.0, 20.5],
    };
    const line = BraceCodec.encode(o);
    const back = BraceCodec.decode(line);
    expect(back).not.toBeNull();
    expect(back!.wallMs).toBe(o.wallMs);
    expect(back!.sessionId).toBe('s1');
    expect(back!.sessionKey).toBe('walk');
    expect(back!.side).toBe('R');
    expect(back!.provenance).toBe('replay');
    expect(back!.unit).toBe(UNIT_ADC_COUNTS);
    expect(back!.calibration).toBe('cal-a');
    expect(back!.raw).toEqual([1, 2, 3]);
    expect(back!.angles).toHaveLength(2);
    expect(Math.abs(back!.angles[1] - 20.5)).toBeLessThan(1e-9);

    expect(line.startsWith('1795000000000|s1|walk|R|replay|adc_counts|cal-a|1;2;3|10;20.5')).toBe(true);

    const many = BraceCodec.decodeAll(line + '\n' + line);
    expect(many).toHaveLength(2);
  });

  test('truncated legacy line still parses, uncalibrated, no angles/raw', () => {
    const o = BraceCodec.decode('1795000000000|s1|walk|L');
    expect(o).not.toBeNull();
    expect(isLeft(o!)).toBe(true);
    expect(isCalibrated(o!)).toBe(false);
    expect(o!.calibration).toBe(UNCALIBRATED);
    expect(o!.angles).toHaveLength(0);
    expect(o!.raw).toHaveLength(0);
  });

  test('one bad line cannot wipe the rest', () => {
    const many = BraceCodec.decodeAll(
      'garbage\n' + '1795000000000|s1|walk|L|replay|adc_counts|cal-a|1;2|8;9\n' + '\n' + 'not|a|number|L',
    );
    expect(many).toHaveLength(1);
  });
});
