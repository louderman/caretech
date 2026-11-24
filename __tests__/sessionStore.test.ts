/** Ported from CareTechTests.java: legacySessionRecord. */
import * as SessionStore from '../src/core/sessionStore';

describe('SessionStore.parse', () => {
  test('legacy 2-field record parses with derived finish', () => {
    const old = SessionStore.parse('1700000000000|45000');
    expect(old).toHaveLength(1);
    expect(old[0].finishWallMs).toBe(1700000045000);
  });

  test('corrupt record skipped, history kept; new record keeps its stored finish', () => {
    const mixed = SessionStore.parse('1700000000000|45000;1700000100000|60000|1700000160000;junk');
    expect(mixed).toHaveLength(2);
    expect(mixed[1].finishWallMs).toBe(1700000160000);
  });

  test('empty and null payloads yield no sessions', () => {
    expect(SessionStore.parse('')).toHaveLength(0);
    expect(SessionStore.parse(null)).toHaveLength(0);
    expect(SessionStore.parse(undefined)).toHaveLength(0);
  });
});
