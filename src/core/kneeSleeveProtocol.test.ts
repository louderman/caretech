import {
  decodeDataPacket,
  encodeDataPacketForTest,
  parseInfoString,
  mvToOhms,
  ohmsToMicrosiemens,
  toReading,
  detectSeqGap,
  DATA_PACKET_LENGTH,
} from './kneeSleeveProtocol';

describe('decodeDataPacket', () => {
  it('decodes a well-formed 13-byte packet (little-endian)', () => {
    const bytes = encodeDataPacketForTest({
      seq: 42,
      tMs: 12034,
      mvA: 1650,
      mvB: 0,
      battMv: 4100,
      flags: 0,
    });
    expect(bytes.length).toBe(DATA_PACKET_LENGTH);

    const result = decodeDataPacket(bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sample).toEqual({
      seq: 42,
      tMs: 12034,
      mvA: 1650,
      mvB: 0,
      battMv: 4100,
      flags: 0,
      clippedA: false,
      clippedB: false,
      lowBattery: false,
    });
  });

  it('rejects any length other than 13 bytes, visibly', () => {
    const tooShort = decodeDataPacket(new Uint8Array(12));
    expect(tooShort.ok).toBe(false);
    if (tooShort.ok) return;
    expect(tooShort.receivedLength).toBe(12);
    expect(tooShort.error).toMatch(/13-byte/);

    const tooLong = decodeDataPacket(new Uint8Array(20));
    expect(tooLong.ok).toBe(false);
    if (tooLong.ok) return;
    expect(tooLong.receivedLength).toBe(20);
  });

  it('decodes each flag bit independently', () => {
    const clippedAOnly = decodeDataPacket(
      encodeDataPacketForTest({ seq: 1, tMs: 0, mvA: 2500, mvB: 0, battMv: 0, flags: 0b001 }),
    );
    expect(clippedAOnly.ok && clippedAOnly.sample.clippedA).toBe(true);
    expect(clippedAOnly.ok && clippedAOnly.sample.clippedB).toBe(false);
    expect(clippedAOnly.ok && clippedAOnly.sample.lowBattery).toBe(false);

    const clippedBAndLowBatt = decodeDataPacket(
      encodeDataPacketForTest({ seq: 1, tMs: 0, mvA: 0, mvB: 2500, battMv: 3200, flags: 0b110 }),
    );
    expect(clippedBAndLowBatt.ok && clippedBAndLowBatt.sample.clippedA).toBe(false);
    expect(clippedBAndLowBatt.ok && clippedBAndLowBatt.sample.clippedB).toBe(true);
    expect(clippedBAndLowBatt.ok && clippedBAndLowBatt.sample.lowBattery).toBe(true);
  });

  it('handles the uint16 seq wraparound boundary and uint32 t_ms', () => {
    const result = decodeDataPacket(
      encodeDataPacketForTest({ seq: 65535, tMs: 4000000000, mvA: 0, mvB: 0, battMv: 0, flags: 0 }),
    );
    expect(result.ok && result.sample.seq).toBe(65535);
    expect(result.ok && result.sample.tMs).toBe(4000000000);
  });
});

describe('parseInfoString', () => {
  it('parses the doc example exactly', () => {
    const info = parseInfoString('fw=1.0;rate=50;stream=1;rf=10000;vcc=3300;clip=2500');
    expect(info.fw).toBe('1.0');
    expect(info.rateHz).toBe(50);
    expect(info.streaming).toBe(true);
    expect(info.rfOhm).toBe(10000);
    expect(info.vccMv).toBe(3300);
    expect(info.clipMv).toBe(2500);
    expect(info.missingForConversion).toEqual([]);
  });

  it('flags missing rf/vcc for conversion instead of guessing them', () => {
    const info = parseInfoString('fw=1.0;rate=50');
    expect(info.rfOhm).toBeNull();
    expect(info.vccMv).toBeNull();
    expect(info.missingForConversion.sort()).toEqual(['rf', 'vcc']);
  });

  it('never throws on malformed or empty input', () => {
    expect(() => parseInfoString('')).not.toThrow();
    expect(() => parseInfoString('garbage;;;no-equals-here')).not.toThrow();
    expect(() => parseInfoString(undefined as unknown as string)).not.toThrow();
  });

  it('is case-insensitive on keys and tolerates whitespace', () => {
    const info = parseInfoString(' RF = 10000 ; VCC=3300 ');
    expect(info.rfOhm).toBe(10000);
    expect(info.vccMv).toBe(3300);
  });
});

describe('mvToOhms / ohmsToMicrosiemens (doc formula)', () => {
  it('matches the doc formula for a clean round number', () => {
    // R = rf * (vcc - mv) / mv = 10000 * (3300 - 1650) / 1650 = 10000
    expect(mvToOhms(1650, 10000, 3300)).toBe(10000);
    expect(ohmsToMicrosiemens(10000)).toBe(100);
  });

  it('treats mv <= 0 as unloaded/open, never 0 ohms', () => {
    expect(mvToOhms(0, 10000, 3300)).toBeNull();
    expect(mvToOhms(-1, 10000, 3300)).toBeNull();
    expect(ohmsToMicrosiemens(null)).toBeNull();
  });

  it('propagates null through to microsiemens instead of NaN/Infinity', () => {
    const ohms = mvToOhms(0, 10000, 3300);
    expect(ohmsToMicrosiemens(ohms)).toBeNull();
  });
});

describe('toReading', () => {
  const info = parseInfoString('fw=1.0;rate=50;stream=1;rf=10000;vcc=3300;clip=2500');

  it('converts both channels and flags clipping from the firmware bit', () => {
    const sample = decodeDataPacket(
      encodeDataPacketForTest({ seq: 1, tMs: 100, mvA: 1650, mvB: 0, battMv: 4100, flags: 0b001 }),
    );
    expect(sample.ok).toBe(true);
    if (!sample.ok) return;
    const reading = toReading(sample.sample, info);
    expect(reading.ohmsA).toBe(10000);
    expect(reading.microsiemensA).toBe(100);
    expect(reading.ohmsB).toBeNull(); // mvB=0 -> open
    expect(reading.microsiemensB).toBeNull();
    expect(reading.clippedA).toBe(true);
    expect(reading.clippedB).toBe(false);
  });

  it('also flags clipping from the Info clip threshold even if the firmware bit is clear', () => {
    const sample = decodeDataPacket(
      encodeDataPacketForTest({ seq: 1, tMs: 100, mvA: 2600, mvB: 0, battMv: 4100, flags: 0 }),
    );
    expect(sample.ok).toBe(true);
    if (!sample.ok) return;
    const reading = toReading(sample.sample, info);
    expect(reading.clippedA).toBe(true); // 2600 >= clip (2500) even though flag bit0 is 0
  });

  it('returns null ohms/uS for both channels when rf/vcc are missing, never a guess', () => {
    const noConversionInfo = parseInfoString('fw=1.0');
    const sample = decodeDataPacket(
      encodeDataPacketForTest({ seq: 1, tMs: 100, mvA: 1650, mvB: 1650, battMv: 0, flags: 0 }),
    );
    expect(sample.ok).toBe(true);
    if (!sample.ok) return;
    const reading = toReading(sample.sample, noConversionInfo);
    expect(reading.ohmsA).toBeNull();
    expect(reading.ohmsB).toBeNull();
  });
});

describe('detectSeqGap', () => {
  it('is 0 for the very first sample of a connection', () => {
    expect(detectSeqGap(null, 0)).toBe(0);
    expect(detectSeqGap(null, 500)).toBe(0);
  });

  it('is 0 for consecutive sequence numbers', () => {
    expect(detectSeqGap(5, 6)).toBe(0);
  });

  it('counts dropped packets correctly', () => {
    expect(detectSeqGap(5, 8)).toBe(2); // 6 and 7 were dropped
  });

  it('wraps correctly across the uint16 boundary (65535 -> 0)', () => {
    expect(detectSeqGap(65535, 0)).toBe(0);
    expect(detectSeqGap(65534, 0)).toBe(1); // 65535 dropped
    expect(detectSeqGap(65535, 2)).toBe(2); // 0 and 1 dropped after wraparound
  });
});
