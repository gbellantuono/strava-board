import { NextRequest, NextResponse } from 'next/server';
import { hms, stravaFetch } from '../../../lib';
import type { StravaActivity } from '../../../lib';
import { supabase } from '../../../lib/supabase';
import { ensureAccessToken, type AthleteRow } from '../../../lib/stravaAuth';

type AthleteAgg = {
  name: string;
  runs: number;
  totalDistM: number;
  maxDistM: number;
  totalTimeS: number;
  bestPaceMinPerKm: number; // lower is better; Infinity if none
  lastRunAtMs: number; // timestamp ms of most recent run
  firstRunAtMs: number; // timestamp ms of earliest run in range
  activeDays: number; // number of distinct calendar days with at least one run
  activeWeeks: number; // number of distinct calendar weeks with at least one run
  longestGapDays?: number; // longest inactivity gap in days between active days
};

type MonthlyAthleteAgg = {
  runs: number; // active days in month
  totalDistM: number;
  maxDistM: number;
  totalTimeS: number;
  bestPaceMinPerKm: number;
  lastRunAtMs: number;
  daySet: Set<string>;
};

function parseDateToEpoch(input: string | null): number | null {
  if (!input) return null;
  let d: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    d = new Date(`${input}T00:00:00Z`);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(input)) {
    const [dd, mm, yyyy] = input.split('-').map(Number);
    d = new Date(Date.UTC(yyyy, (mm || 1) - 1, dd || 1, 0, 0, 0));
  }
  if (!d || isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

function parseTargetToEpoch(input: string | null): number {
  const fallback = Math.floor(Date.parse('2026-12-31T00:00:00Z') / 1000); // default target
  if (!input) return fallback;
  const d = new Date(input);
  const t = d.getTime();
  return isNaN(t) ? fallback : Math.floor(t / 1000);
}

const CLUB_ID = process.env.STRAVA_CLUB_ID;

export async function GET(req: NextRequest) {
  // Require logged-in user and enforce club membership using their Strava cookie token
  const token = req.cookies.get('strava_access_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (CLUB_ID) {
    try {
      const clubsRes = await fetch(
        'https://www.strava.com/api/v3/athlete/clubs',
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }
      );
      if (!clubsRes.ok) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const clubs = (await clubsRes.json()) as Array<{ id: number }>;
      const requiredId = Number(CLUB_ID);
      const isMember = clubs.some(
        (c) => c && typeof c.id === 'number' && c.id === requiredId
      );
      if (!isMember) {
        return NextResponse.json(
          { error: 'Forbidden: not in club' },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const url = new URL(req.url);
  const afterEpoch = parseDateToEpoch(url.searchParams.get('after'));
  const beforeEpoch = parseDateToEpoch(url.searchParams.get('before'));
  // Enforce challenge start date (defaults to 2025-10-26 if not provided)
  const startDateStr = process.env.NEXT_PUBLIC_START_DATE || '2026-03-01';
  const campaignStartEpoch = parseDateToEpoch(startDateStr);
  const effectiveAfterEpoch =
    afterEpoch && campaignStartEpoch
      ? Math.max(afterEpoch, campaignStartEpoch)
      : afterEpoch ?? campaignStartEpoch;
  // Fetch list of authorized athletes from Supabase

  const { data: athletes, error } = await supabase
    .from('athletes')
    .select(
      'athlete_id, firstname, lastname, profile, access_token, refresh_token, expires_at'
    );
  if (error) {
    return NextResponse.json(
      { error: 'Failed to load athletes', detail: error.message },
      { status: 500 }
    );
  }
  if (!athletes || athletes.length === 0) {
    return NextResponse.json({ leaderboard: [], monthly: [] });
  }

  // Aggregate across all athletes by fetching their personal activities
  const byAthlete = new Map<number, AthleteAgg>();
  // Monthly breakdown: Map<athleteId, Map<monthKey, MonthlyAthleteAgg>>
  const monthlyByAthlete = new Map<number, Map<string, MonthlyAthleteAgg>>();
  for (const row of athletes as AthleteRow[]) {
    const name =
      `${row.firstname ?? ''} ${row.lastname ?? ''}`.trim() ||
      `Athlete ${row.athlete_id}`;
    const access = await ensureAccessToken(row);
    if (!access) continue;
    let acts: StravaActivity[] = [];
    try {
      // Fetch broadly (no campaign start filter) so monthly breakdown includes older months
      const params: string[] = ['per_page=200'];
      if (beforeEpoch) params.push(`before=${beforeEpoch}`);
      acts = await stravaFetch<StravaActivity[]>(
        `/athlete/activities?${params.join('&')}`,
        access
      );
    } catch {
      continue;
    }
    // All runs (for monthly breakdown and stats)
    const allRuns = acts.filter((a) => {
      const kind = (a.sport_type ?? a.type ?? '').toLowerCase();
      return kind.includes('run');
    });
    const current = byAthlete.get(row.athlete_id) ?? {
      name,
      runs: 0,
      totalDistM: 0,
      maxDistM: 0,
      totalTimeS: 0,
      bestPaceMinPerKm: Number.POSITIVE_INFINITY,
      lastRunAtMs: 0,
      firstRunAtMs: Number.POSITIVE_INFINITY,
      activeDays: 0,
      activeWeeks: 0,
    };
    // Per-athlete monthly map (uses allRuns, not campaign-filtered)
    if (!monthlyByAthlete.has(row.athlete_id)) {
      monthlyByAthlete.set(row.athlete_id, new Map());
    }
    const athleteMonthly = monthlyByAthlete.get(row.athlete_id)!;
    for (const a of allRuns) {
      const kind_ts = a.start_date ? Date.parse(a.start_date) : NaN;
      if (!isNaN(kind_ts)) {
        const md = new Date(kind_ts);
        const miso = new Date(
          Date.UTC(md.getUTCFullYear(), md.getUTCMonth(), md.getUTCDate())
        )
          .toISOString()
          .slice(0, 10);
        const monthKey = miso.slice(0, 7);
        const mAgg = athleteMonthly.get(monthKey) ?? {
          runs: 0,
          totalDistM: 0,
          maxDistM: 0,
          totalTimeS: 0,
          bestPaceMinPerKm: Number.POSITIVE_INFINITY,
          lastRunAtMs: 0,
          daySet: new Set<string>(),
        };
        mAgg.totalDistM += a.distance || 0;
        mAgg.maxDistM = Math.max(mAgg.maxDistM, a.distance || 0);
        mAgg.totalTimeS += a.moving_time || 0;
        const mDistKm = (a.distance || 0) / 1000;
        const mTimeMin = (a.moving_time || 0) / 60;
        if (mDistKm > 0 && mTimeMin > 0) {
          const mPace = mTimeMin / mDistKm;
          if (mPace < mAgg.bestPaceMinPerKm) mAgg.bestPaceMinPerKm = mPace;
        }
        if (kind_ts > mAgg.lastRunAtMs) mAgg.lastRunAtMs = kind_ts;
        mAgg.daySet.add(miso);
        mAgg.runs = mAgg.daySet.size;
        athleteMonthly.set(monthKey, mAgg);
      }
    }
    // Leaderboard aggregation: use allRuns for stats, campaign-filtered for run count
    const campaignDaySet = new Set<string>();
    const campaignWeekSet = new Set<string>();
    for (const a of allRuns) {
      current.totalDistM += a.distance || 0;
      current.maxDistM = Math.max(current.maxDistM, a.distance || 0);
      current.totalTimeS += a.moving_time || 0;
      const distKm = (a.distance || 0) / 1000;
      const timeMin = (a.moving_time || 0) / 60;
      if (distKm > 0 && timeMin > 0) {
        const pace = timeMin / distKm; // min/km
        if (pace < current.bestPaceMinPerKm) current.bestPaceMinPerKm = pace;
      }
      const ts = a.start_date ? Date.parse(a.start_date) : NaN;
      if (!isNaN(ts)) {
        if (ts > current.lastRunAtMs) current.lastRunAtMs = ts;
        if (ts < current.firstRunAtMs) current.firstRunAtMs = ts;
        // Use UTC calendar date
        const d = new Date(ts);
        const iso = new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        )
          .toISOString()
          .slice(0, 10);
        // Check if this run falls within the campaign period for runs count
        const inCampaign =
          (!effectiveAfterEpoch || ts >= effectiveAfterEpoch * 1000) &&
          (!beforeEpoch || ts < beforeEpoch * 1000);
        if (inCampaign) {
          campaignDaySet.add(iso);
          // Compute Monday (UTC) of this week to count active weeks
          const dow = d.getUTCDay(); // 0=Sun..6=Sat
          const daysSinceMon = (dow + 6) % 7; // 0 if Monday
          const mondayMs =
            Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
            daysSinceMon * 86400000;
          const mondayIso = new Date(mondayMs).toISOString().slice(0, 10);
          campaignWeekSet.add(mondayIso);
        }
      }
    }
    current.activeDays = campaignDaySet.size;
    // Use distinct active days in campaign as the primary "runs" count
    current.runs = current.activeDays;
    current.activeWeeks = campaignWeekSet.size;
    // Compute longest inactivity gap (in days) between sorted active days
    if (campaignDaySet.size > 0) {
      const dayEpochs = Array.from(campaignDaySet)
        .map((iso) => Date.parse(`${iso}T00:00:00Z`))
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);
      let longestGapDays = 0;
      for (let i = 1; i < dayEpochs.length; i++) {
        const gapDays =
          Math.floor((dayEpochs[i] - dayEpochs[i - 1]) / 86400000) - 1;
        if (gapDays > longestGapDays) longestGapDays = gapDays;
      }
      current.longestGapDays = Math.max(0, longestGapDays);
    } else {
      current.longestGapDays = undefined;
    }
    byAthlete.set(row.athlete_id, current);
  }

  const toMin = (s: number) => s / 60;
  const toKm = (m: number) => m / 1000;
  const rows = Array.from(byAthlete.entries()).map(([athlete_id, agg]) => {
    const total_km = toKm(agg.totalDistM);
    // Count total active days across all months for averages (not just campaign period)
    const allMonthsMap = monthlyByAthlete.get(athlete_id);
    const totalActiveDays = allMonthsMap
      ? Array.from(allMonthsMap.values()).reduce((sum, m) => sum + m.runs, 0)
      : 0;
    const avg_run_time_mins =
      totalActiveDays > 0 ? toMin(agg.totalTimeS) / totalActiveDays : 0;
    const avg_pace_min_per_km =
      total_km > 0 ? toMin(agg.totalTimeS) / total_km : 0;
    const best_pace_min_per_km =
      agg.bestPaceMinPerKm === Number.POSITIVE_INFINITY
        ? 0
        : Number(agg.bestPaceMinPerKm.toFixed(2));
    const last_run = agg.lastRunAtMs
      ? new Date(agg.lastRunAtMs).toISOString()
      : null;
    // Average runs per month: use monthly breakdown for this athlete
    const athleteMonths = monthlyByAthlete.get(athlete_id);
    let avg_runs_per_month = 0;
    if (athleteMonths && athleteMonths.size > 0) {
      const totalMonthlyRuns = Array.from(athleteMonths.values()).reduce(
        (sum, m) => sum + m.runs,
        0
      );
      avg_runs_per_month = Number(
        (totalMonthlyRuns / athleteMonths.size).toFixed(1)
      );
    }
    const profile = (athletes as AthleteRow[]).find(
      (a) => a.athlete_id === athlete_id
    )?.profile; // quick lookup (dataset is small)
    return {
      athlete_id,
      athlete_name: agg.name,
      profile: profile ?? null,
      total_runs: agg.runs,
      total_distance_km: Number(total_km.toFixed(2)),
      max_distance_km: Number(toKm(agg.maxDistM).toFixed(2)),
      total_run_time_hms: hms(agg.totalTimeS),
      average_run_time_mins: Number(avg_run_time_mins.toFixed(2)),
      average_pace_min_per_km: Number(avg_pace_min_per_km.toFixed(2)),
      best_pace_min_per_km,
      last_run,
      avg_runs_per_month,
    };
  });

  // Rank by number of runs (desc), tie-breaker: total_distance_km (desc)
  const ranked = [...rows].sort(
    (a, b) =>
      b.total_runs - a.total_runs || b.total_distance_km - a.total_distance_km
  );
  const positionMap = new Map<
    number,
    { position: number; medal: string | null }
  >();
  ranked.forEach((r, idx) => {
    const position = idx + 1;
    const medal =
      position === 1
        ? 'gold'
        : position === 2
        ? 'silver'
        : position === 3
        ? 'bronze'
        : null;
    positionMap.set(r.athlete_id, { position, medal });
  });

  const withRank = rows.map((r) => ({
    ...r,
    position: positionMap.get(r.athlete_id)?.position ?? 0,
    medal: positionMap.get(r.athlete_id)?.medal ?? null,
  }));

  // Build monthly breakdown: collect all months, then per month sort runners by runs desc
  const allMonths = new Set<string>();
  for (const mMap of monthlyByAthlete.values()) {
    for (const mk of mMap.keys()) allMonths.add(mk);
  }
  const monthsSorted = Array.from(allMonths)
    .filter((mk) => mk >= '2025-10' && mk <= new Date().toISOString().slice(0, 7))
    .sort()
    .reverse(); // most recent first
  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const monthly = monthsSorted.map((mk) => {
    const [yyyy, mm] = mk.split('-').map(Number);
    const label = `${MONTH_NAMES[(mm || 1) - 1]} ${yyyy}`;
    const runners: {
      athlete_id: number;
      athlete_name: string;
      profile: string | null;
      runs: number;
      total_distance_km: number;
      max_distance_km: number;
      total_run_time_hms: string;
      average_run_time_mins: number;
      average_pace_min_per_km: number;
      best_pace_min_per_km: number;
      last_run: string | null;
    }[] = [];
    for (const [aid, mMap] of monthlyByAthlete.entries()) {
      const mAgg = mMap.get(mk);
      if (!mAgg || mAgg.runs === 0) continue;
      const aRow = (athletes as AthleteRow[]).find(
        (a) => a.athlete_id === aid
      );
      const name =
        `${aRow?.firstname ?? ''} ${aRow?.lastname ?? ''}`.trim() ||
        `Athlete ${aid}`;
      const mTotalKm = mAgg.totalDistM / 1000;
      const mTotalMin = mAgg.totalTimeS / 60;
      runners.push({
        athlete_id: aid,
        athlete_name: name,
        profile: aRow?.profile ?? null,
        runs: mAgg.runs,
        total_distance_km: Number(mTotalKm.toFixed(2)),
        max_distance_km: Number((mAgg.maxDistM / 1000).toFixed(2)),
        total_run_time_hms: hms(mAgg.totalTimeS),
        average_run_time_mins: mAgg.runs > 0 ? Number((mTotalMin / mAgg.runs).toFixed(2)) : 0,
        average_pace_min_per_km: mTotalKm > 0 ? Number((mTotalMin / mTotalKm).toFixed(2)) : 0,
        best_pace_min_per_km: mAgg.bestPaceMinPerKm === Number.POSITIVE_INFINITY ? 0 : Number(mAgg.bestPaceMinPerKm.toFixed(2)),
        last_run: mAgg.lastRunAtMs ? new Date(mAgg.lastRunAtMs).toISOString() : null,
      });
    }
    runners.sort((a, b) => b.runs - a.runs || b.total_distance_km - a.total_distance_km);
    return { month: mk, label, runners };
  });

  return NextResponse.json({ leaderboard: withRank, monthly });
}
