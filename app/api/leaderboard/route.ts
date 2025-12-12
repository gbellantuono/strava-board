import { NextRequest, NextResponse } from 'next/server';
import { hms, stravaFetch } from '../../../lib';
import type { StravaActivity } from '../../../lib';
import { supabase } from '../../../lib/supabase';
import { ensureAccessToken, type AthleteRow } from '../../../lib/stravaAuth';
import {
  projectRunsActiveDays,
  projectRunsActiveWeeks,
} from '../../../lib/projection';

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
  const fallback = Math.floor(Date.parse('2025-12-11T14:00:00Z') / 1000); // default target
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
  const targetEpoch = parseTargetToEpoch(url.searchParams.get('target'));
  // Enforce challenge start date (defaults to 2025-10-26 if not provided)
  const startDateStr = process.env.NEXT_PUBLIC_START_DATE || '2025-10-26';
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
    return NextResponse.json([]);
  }

  // Aggregate across all athletes by fetching their personal activities
  const byAthlete = new Map<number, AthleteAgg>();
  for (const row of athletes as AthleteRow[]) {
    const name =
      `${row.firstname ?? ''} ${row.lastname ?? ''}`.trim() ||
      `Athlete ${row.athlete_id}`;
    const access = await ensureAccessToken(row);
    if (!access) continue;
    // For safety, also enforce club membership per athlete using their own token,
    // so stale or non-member accounts in Supabase are not shown on the board.
    if (CLUB_ID) {
      const requiredId = Number(CLUB_ID);
      if (!Number.isNaN(requiredId)) {
        try {
          const clubsRes = await fetch(
            'https://www.strava.com/api/v3/athlete/clubs',
            {
              headers: { Authorization: `Bearer ${access}` },
              cache: 'no-store',
            }
          );
          if (!clubsRes.ok) {
            continue;
          }
          const clubs = (await clubsRes.json()) as Array<{ id: number }>;
          const isMember = clubs.some(
            (c) => c && typeof c.id === 'number' && c.id === requiredId
          );
          if (!isMember) {
            continue;
          }
        } catch {
          continue;
        }
      }
    }
    let acts: StravaActivity[] = [];
    try {
      const params: string[] = ['per_page=50'];
      if (effectiveAfterEpoch) params.push(`after=${effectiveAfterEpoch}`);
      if (beforeEpoch) params.push(`before=${beforeEpoch}`);
      acts = await stravaFetch<StravaActivity[]>(
        `/athlete/activities?${params.join('&')}`,
        access
      );
    } catch {
      continue;
    }
    const runs = acts.filter((a) => {
      const kind = (a.sport_type ?? a.type ?? '').toLowerCase();
      const ts = a.start_date ? Date.parse(a.start_date) : NaN;
      const inRange =
        (!effectiveAfterEpoch ||
          (!isNaN(ts) && ts >= effectiveAfterEpoch * 1000)) &&
        (!beforeEpoch || (!isNaN(ts) && ts < beforeEpoch * 1000));
      return kind.includes('run') && inRange;
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
    // Track unique active days (UTC date) for active-days projection
    const daySet = new Set<string>();
    // Track unique active weeks by Monday (UTC) date string
    const weekSet = new Set<string>();
    for (const a of runs) {
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
        // Use UTC calendar date to count active days
        const d = new Date(ts);
        const iso = new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        )
          .toISOString()
          .slice(0, 10);
        daySet.add(iso);
        // Compute Monday (UTC) of this week to count active weeks
        const dow = d.getUTCDay(); // 0=Sun..6=Sat
        const daysSinceMon = (dow + 6) % 7; // 0 if Monday
        const mondayMs =
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
          daysSinceMon * 86400000;
        const mondayIso = new Date(mondayMs).toISOString().slice(0, 10);
        weekSet.add(mondayIso);
      }
    }
    current.activeDays = daySet.size;
    // Use distinct active days as the primary "runs" count
    current.runs = current.activeDays;
    current.activeWeeks = weekSet.size;
    // Compute longest inactivity gap (in days) between sorted active days
    if (daySet.size > 0) {
      const dayEpochs = Array.from(daySet)
        .map((iso) => Date.parse(`${iso}T00:00:00Z`))
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);
      let longestGapDays = 0;
      for (let i = 1; i < dayEpochs.length; i++) {
        const gapDays =
          Math.floor((dayEpochs[i] - dayEpochs[i - 1]) / 86400000) - 1; // days strictly between
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
  const nowEpoch = Math.floor(Date.now() / 1000);
  const rows = Array.from(byAthlete.entries()).map(([athlete_id, agg]) => {
    const total_km = toKm(agg.totalDistM);
    const avg_run_time_mins =
      agg.runs > 0 ? toMin(agg.totalTimeS) / agg.runs : 0;
    const avg_pace_min_per_km =
      total_km > 0 ? toMin(agg.totalTimeS) / total_km : 0;
    const best_pace_min_per_km =
      agg.bestPaceMinPerKm === Number.POSITIVE_INFINITY
        ? 0
        : Number(agg.bestPaceMinPerKm.toFixed(2));
    const last_run = agg.lastRunAtMs
      ? new Date(agg.lastRunAtMs).toISOString()
      : null;
    // Projection: weekly consistency model
    // Assumption: one or more runs per active week. Estimate total active weeks from start to target
    // using observed active-week rate (active weeks / weeks elapsed), then multiply by runs/active-week.
    const startEpoch =
      effectiveAfterEpoch ??
      (isFinite(agg.firstRunAtMs) && agg.firstRunAtMs > 0
        ? Math.floor(agg.firstRunAtMs / 1000)
        : null);
    const projected_runs = projectRunsActiveWeeks({
      runs: agg.runs,
      activeWeeks: agg.activeWeeks,
      firstRunAtMs: agg.firstRunAtMs,
      afterEpoch: effectiveAfterEpoch ?? null,
      targetEpoch,
      nowEpoch,
    });
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
      projected_runs,
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

  return NextResponse.json(withRank);
}
