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
  const afterEpoch = parseDateToEpoch(url.searchParams.get('after'));
  const beforeEpoch = parseDateToEpoch(url.searchParams.get('before'));
  // Fetch list of authorized athletes from Supabase
  const { data: athletes, error } = await supabase
    .from('athletes')
    .select(
      'athlete_id, firstname, lastname, access_token, refresh_token, expires_at'
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
    let acts: StravaActivity[] = [];
    try {
      const params: string[] = ['per_page=50'];
      if (afterEpoch) params.push(`after=${afterEpoch}`);
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
        (!afterEpoch || (!isNaN(ts) && ts >= afterEpoch * 1000)) &&
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
    };
    for (const a of runs) {
      current.runs += 1;
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
      if (!isNaN(ts) && ts > current.lastRunAtMs) current.lastRunAtMs = ts;
    }
    byAthlete.set(row.athlete_id, current);
  }

  const toMin = (s: number) => s / 60;
  const toKm = (m: number) => m / 1000;
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
    return {
      athlete_id,
      athlete_name: agg.name,
      total_runs: agg.runs,
      total_distance_km: Number(total_km.toFixed(2)),
      max_distance_km: Number(toKm(agg.maxDistM).toFixed(2)),
      total_run_time_hms: hms(agg.totalTimeS),
      average_run_time_mins: Number(avg_run_time_mins.toFixed(2)),
      average_pace_min_per_km: Number(avg_pace_min_per_km.toFixed(2)),
      best_pace_min_per_km,
      last_run,
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
