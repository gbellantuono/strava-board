export function projectRunsActiveDays(params: {
  runs: number;
  activeDays: number;
  firstRunAtMs: number; // earliest run timestamp ms
  afterEpoch: number | null; // explicit after filter epoch (seconds) if any
  targetEpoch: number; // target date epoch (seconds)
  nowEpoch?: number; // override for tests
  longestGapDays?: number; // longest gap (in days) between active days since start
}): number {
  const { runs, activeDays, firstRunAtMs, afterEpoch, targetEpoch } = params;
  const nowEpoch = params.nowEpoch ?? Math.floor(Date.now() / 1000);
  if (runs <= 0) return 0;
  const startEpoch =
    afterEpoch ??
    (isFinite(firstRunAtMs) && firstRunAtMs > 0
      ? Math.floor(firstRunAtMs / 1000)
      : null);
  if (!startEpoch || targetEpoch <= startEpoch) return runs; // no projection possible
  const daysElapsed = Math.max(1, Math.floor((nowEpoch - startEpoch) / 86400));
  const daysTotal = Math.max(
    daysElapsed,
    Math.floor((targetEpoch - startEpoch) / 86400)
  );
  // Density-adjusted active-days: forecast active days then multiply by runs per active day
  const safeActiveDays = Math.max(1, activeDays);
  const activeDayRate = safeActiveDays / daysElapsed; // fraction of days with at least one run
  const projectedActiveDays = Math.round(activeDayRate * daysTotal);
  const runsPerActiveDay = runs / safeActiveDays;
  let projectedTotalRuns = projectedActiveDays * runsPerActiveDay;
  // Consistency factor based on longest inactivity gap since start (non-linear inverse decay)
  const lgd = Math.max(0, Math.floor(params.longestGapDays ?? 0));
  // Inverse-decay curve with stronger penalty than the gentle version; clamped at 0.3
  const consistencyFactor = Math.max(0.3, 1 / (1 + lgd / 7));
  projectedTotalRuns = Math.round(projectedTotalRuns * consistencyFactor);
  return Math.max(runs, projectedTotalRuns);
}

export function projectRunsActiveWeeks(params: {
  runs: number;
  activeWeeks: number;
  firstRunAtMs: number; // earliest run timestamp ms
  afterEpoch: number | null; // explicit after filter epoch (seconds) if any
  targetEpoch: number; // target date epoch (seconds)
  nowEpoch?: number; // override for tests
}): number {
  const { runs, activeWeeks, firstRunAtMs, afterEpoch, targetEpoch } = params;
  const nowEpoch = params.nowEpoch ?? Math.floor(Date.now() / 1000);
  if (runs <= 0) return 0;
  const startEpoch =
    afterEpoch ??
    (isFinite(firstRunAtMs) && firstRunAtMs > 0
      ? Math.floor(firstRunAtMs / 1000)
      : null);
  if (!startEpoch || targetEpoch <= startEpoch) return runs;
  const weeksElapsed = Math.max(
    1,
    Math.floor((nowEpoch - startEpoch) / 604800) // seconds in a week
  );
  const weeksTotal = Math.max(
    weeksElapsed,
    Math.floor((targetEpoch - startEpoch) / 604800)
  );
  const safeActiveWeeks = Math.max(1, activeWeeks);
  const activeWeekRate = safeActiveWeeks / weeksElapsed;
  const projectedActiveWeeks = Math.round(activeWeekRate * weeksTotal);
  const runsPerActiveWeek = runs / safeActiveWeeks;
  const projectedTotalRuns = Math.round(
    projectedActiveWeeks * runsPerActiveWeek
  );
  return Math.max(runs, projectedTotalRuns);
}
