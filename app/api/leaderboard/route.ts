import { NextRequest, NextResponse } from 'next/server';
import { hms, stravaFetch } from '../../../lib';
import type { StravaActivity } from '../../../lib';
import { supabase } from '../../../lib/supabase';
import { ensureAccessToken, type AthleteRow } from '../../../lib/stravaAuth';

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
  const beforeEpoch = parseDateToEpoch(url.searchParams.get('before'));

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
    return NextResponse.json({ competition: [], thisMonth: [], monthly: [] });
  }

  // Monthly breakdown: Map<athleteId, Map<monthKey, MonthlyAthleteAgg>>
  const monthlyByAthlete = new Map<number, Map<string, MonthlyAthleteAgg>>();
  const athleteNames = new Map<number, string>();

  for (const row of athletes as AthleteRow[]) {
    const name =
      `${row.firstname ?? ''} ${row.lastname ?? ''}`.trim() ||
      `Athlete ${row.athlete_id}`;
    athleteNames.set(row.athlete_id, name);
    const access = await ensureAccessToken(row);
    if (!access) {
      console.warn(`Skipping athlete ${row.athlete_id} (${name}): no valid access token`);
      continue;
    }
    // Club membership is already verified at login — skip per-athlete club check
    // to avoid hitting Strava rate limits (100 req / 15 min).
    let acts: StravaActivity[] = [];
    try {
      // Fetch all activities from competition start (Oct 28 2025) with pagination
      const COMP_START_EPOCH = Math.floor(Date.UTC(2025, 9, 28) / 1000); // Oct 28 2025
      let page = 1;
      const perPage = 200;
      while (true) {
        const params: string[] = [`per_page=${perPage}`, `page=${page}`, `after=${COMP_START_EPOCH}`];
        if (beforeEpoch) params.push(`before=${beforeEpoch}`);
        const batch = await stravaFetch<StravaActivity[]>(
          `/athlete/activities?${params.join('&')}`,
          access
        );
        acts = acts.concat(batch);
        if (batch.length < perPage) break; // last page
        page++;
      }
    } catch (err) {
      console.warn(`Failed to fetch activities for athlete ${row.athlete_id} (${name}):`, err);
      continue;
    }
    const allRuns = acts.filter((a) => {
      const kind = (a.sport_type ?? a.type ?? '').toLowerCase();
      return kind.includes('run');
    });
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
  }

  // Helper: build a ranked leaderboard from selected months of the monthly data
  const toMin = (s: number) => s / 60;
  const toKm = (m: number) => m / 1000;

  type LeaderboardRow = {
    athlete_id: number;
    athlete_name: string;
    profile: string | null;
    position: number;
    medal: string | null;
    total_runs: number;
    total_distance_km: number;
    max_distance_km: number;
    total_run_time_hms: string;
    average_run_time_mins: number;
    average_pace_min_per_km: number;
    best_pace_min_per_km: number;
    last_run: string | null;
  };

  function buildLeaderboard(monthFilter: (mk: string) => boolean): LeaderboardRow[] {
    const rows: LeaderboardRow[] = [];
    for (const [aid, mMap] of monthlyByAthlete.entries()) {
      let totalDistM = 0, maxDistM = 0, totalTimeS = 0, runs = 0;
      let bestPace = Number.POSITIVE_INFINITY;
      let lastRunAtMs = 0;
      for (const [mk, mAgg] of mMap.entries()) {
        if (!monthFilter(mk)) continue;
        totalDistM += mAgg.totalDistM;
        maxDistM = Math.max(maxDistM, mAgg.maxDistM);
        totalTimeS += mAgg.totalTimeS;
        runs += mAgg.runs;
        if (mAgg.bestPaceMinPerKm < bestPace) bestPace = mAgg.bestPaceMinPerKm;
        if (mAgg.lastRunAtMs > lastRunAtMs) lastRunAtMs = mAgg.lastRunAtMs;
      }
      if (runs === 0) continue;
      const totalKm = toKm(totalDistM);
      const totalMin = toMin(totalTimeS);
      const aRow = (athletes as AthleteRow[]).find((a) => a.athlete_id === aid);
      rows.push({
        athlete_id: aid,
        athlete_name: athleteNames.get(aid) ?? `Athlete ${aid}`,
        profile: aRow?.profile ?? null,
        position: 0,
        medal: null,
        total_runs: runs,
        total_distance_km: Number(totalKm.toFixed(2)),
        max_distance_km: Number(toKm(maxDistM).toFixed(2)),
        total_run_time_hms: hms(totalTimeS),
        average_run_time_mins: runs > 0 ? Number((totalMin / runs).toFixed(2)) : 0,
        average_pace_min_per_km: totalKm > 0 ? Number((totalMin / totalKm).toFixed(2)) : 0,
        best_pace_min_per_km: bestPace === Number.POSITIVE_INFINITY ? 0 : Number(bestPace.toFixed(2)),
        last_run: lastRunAtMs ? new Date(lastRunAtMs).toISOString() : null,
      });
    }
    // Rank (ties on runs get the same position, dense ranking: no skipped positions)
    rows.sort((a, b) => b.total_runs - a.total_runs || b.total_distance_km - a.total_distance_km);
    rows.forEach((r, idx, arr) => {
      if (idx === 0) {
        r.position = 1;
      } else {
        const prev = arr[idx - 1];
        r.position = r.total_runs === prev.total_runs ? prev.position : prev.position + 1;
      }
      r.medal = r.position === 1 ? 'gold' : r.position === 2 ? 'silver' : r.position === 3 ? 'bronze' : null;
    });
    return rows;
  }

  // Competition: from 2025-10 onwards (Oct 28)
  const COMPETITION_START = '2025-10';
  const competition = buildLeaderboard((mk) => mk >= COMPETITION_START);

  // This Month: current calendar month only
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonth = buildLeaderboard((mk) => mk === currentMonth);

  // Build monthly breakdown
  const allMonths = new Set<string>();
  for (const mMap of monthlyByAthlete.values()) {
    for (const mk of mMap.keys()) allMonths.add(mk);
  }
  const monthsSorted = Array.from(allMonths)
    .filter((mk) => mk >= COMPETITION_START && mk < currentMonth)
    .sort()
    .reverse();
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
      const name = athleteNames.get(aid) ?? `Athlete ${aid}`;
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

  return NextResponse.json({ competition, thisMonth, monthly });
}
