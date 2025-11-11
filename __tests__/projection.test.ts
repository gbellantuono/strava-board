/**
 * @jest-environment node
 */
import { projectRunsActiveDays } from '../lib/projection';

describe('projectRunsActiveDays (active-days density model)', () => {
  const targetEpoch = Math.floor(Date.parse('2025-12-11T14:00:00Z') / 1000);
  const makeNow = (iso: string) => Math.floor(Date.parse(iso) / 1000);

  it('returns current runs when no startEpoch (no firstRunAtMs)', () => {
    const runs = projectRunsActiveDays({
      runs: 5,
      activeDays: 5,
      firstRunAtMs: Number.POSITIVE_INFINITY,
      afterEpoch: null,
      targetEpoch,
      nowEpoch: makeNow('2025-01-10T00:00:00Z'),
    });
    expect(runs).toBe(5);
  });

  it('equals runs/day projection when density-adjusted', () => {
    // Athlete started Jan 1 2025, today Jan 10 2025, 10 elapsed days, 6 active days, 6 runs.
    // Runs/day = 6/10 = 0.6; target days from start to target (Dec 11) ~= 345 days total.
    // Projected runs = round(0.6 * 345) = 207.
    const startMs = Date.parse('2025-01-01T00:00:00Z');
    const nowEpoch = makeNow('2025-01-10T12:00:00Z');
    const startEpoch = Math.floor(startMs / 1000);
    const daysElapsed = Math.max(
      1,
      Math.floor((nowEpoch - startEpoch) / 86400)
    );
    const daysTotal = Math.max(
      daysElapsed,
      Math.floor((targetEpoch - startEpoch) / 86400)
    );
    const expected = Math.round((6 / daysElapsed) * daysTotal);

    const runs = projectRunsActiveDays({
      runs: 6,
      activeDays: 6,
      firstRunAtMs: startMs,
      afterEpoch: null,
      targetEpoch,
      nowEpoch,
      longestGapDays: 0,
    });
    expect(runs).toBeGreaterThan(6);
    expect(runs).toBe(expected);
  });

  it('does not project backwards when target before start', () => {
    const earlyTarget = Math.floor(Date.parse('2025-01-05T00:00:00Z') / 1000);
    const runs = projectRunsActiveDays({
      runs: 10,
      activeDays: 5,
      firstRunAtMs: Date.parse('2025-01-06T00:00:00Z'),
      afterEpoch: null,
      targetEpoch: earlyTarget,
      nowEpoch: makeNow('2025-01-10T00:00:00Z'),
    });
    expect(runs).toBe(10);
  });

  it('never reduces runs (uses max with current runs)', () => {
    // If rate would round down, ensure we keep at least current runs
    const runs = projectRunsActiveDays({
      runs: 12,
      activeDays: 2,
      firstRunAtMs: Date.parse('2025-01-01T00:00:00Z'),
      afterEpoch: null,
      targetEpoch,
      nowEpoch: makeNow('2025-01-03T00:00:00Z'),
      longestGapDays: 0,
    });
    expect(runs).toBeGreaterThanOrEqual(12);
  });

  it('reduces projection with long inactivity gaps', () => {
    const startMs = Date.parse('2025-01-01T00:00:00Z');
    const nowEpoch = makeNow('2025-02-01T00:00:00Z');
    const base = projectRunsActiveDays({
      runs: 8,
      activeDays: 8,
      firstRunAtMs: startMs,
      afterEpoch: null,
      targetEpoch,
      nowEpoch,
      longestGapDays: 0,
    });
    const penalized = projectRunsActiveDays({
      runs: 8,
      activeDays: 8,
      firstRunAtMs: startMs,
      afterEpoch: null,
      targetEpoch,
      nowEpoch,
      longestGapDays: 21, // 3-week gap
    });
    expect(penalized).toBeLessThanOrEqual(base);
  });

  it('accounts for multi-run days via density (matches runs/day projection)', () => {
    // 8 runs over 5 active days in 10 elapsed days -> runs/day = 0.8.
    const nowEpoch = makeNow('2025-01-11T00:00:00Z');
    const startMs = Date.parse('2025-01-01T00:00:00Z');
    const expected = Math.round(
      (8 / 10) * Math.floor((targetEpoch - Math.floor(startMs / 1000)) / 86400)
    );
    const runs = projectRunsActiveDays({
      runs: 8,
      activeDays: 5,
      firstRunAtMs: startMs,
      afterEpoch: null,
      targetEpoch,
      nowEpoch,
    });
    expect(runs).toBe(expected);
  });
});
