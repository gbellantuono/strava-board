// @ts-nocheck
// Supabase Edge Function: token-refresh
// Refreshes Strava access tokens for athletes whose tokens are expired or near expiry.
// Can be scheduled (cron) or invoked manually. Optional query: ?athlete_id=123

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type AthleteRow = {
  athlete_id: number;
  firstname?: string | null;
  lastname?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null; // ISO
};

type RefreshResponse = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number; // epoch seconds
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function getEnvOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function refreshTokenFor(
  row: AthleteRow,
  clientId: string,
  clientSecret: string
) {
  if (!row.refresh_token) return null;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
  });
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava refresh error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as RefreshResponse;
  const expiresAtIso = json.expires_at
    ? new Date(json.expires_at * 1000).toISOString()
    : null;
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: expiresAtIso,
  };
}

function isExpiringSoon(
  expiresAtIso: string | null | undefined,
  bufferMs: number
): boolean {
  if (!expiresAtIso) return true; // treat missing expiry as expiring
  const t = Date.parse(expiresAtIso);
  if (isNaN(t)) return true;
  return t <= Date.now() + bufferMs;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      },
    });
  }

  try {
    const SUPABASE_URL = getEnvOrThrow('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = getEnvOrThrow(
      'SUPABASE_SERVICE_ROLE_KEY'
    );
    const STRAVA_CLIENT_ID = getEnvOrThrow('STRAVA_CLIENT_ID');
    const STRAVA_CLIENT_SECRET = getEnvOrThrow('STRAVA_CLIENT_SECRET');
    const BUFFER_MS = Number(
      Deno.env.get('TOKEN_EXPIRY_BUFFER_MS') ?? '300000'
    ); // default 5m

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const url = new URL(req.url);
    const athleteIdParam = url.searchParams.get('athlete_id');
    const force =
      (url.searchParams.get('force') ?? '').toLowerCase() === 'true';
    const bufferOverride = url.searchParams.get('buffer_ms');
    const EFFECTIVE_BUFFER_MS = force
      ? 0
      : Number(
          bufferOverride ?? Deno.env.get('TOKEN_EXPIRY_BUFFER_MS') ?? '300000'
        );

    // Load athletes (optionally a single one)
    const query = supabase
      .from('athletes')
      .select(
        'athlete_id, firstname, lastname, access_token, refresh_token, expires_at'
      );
    const { data: athletes, error } = athleteIdParam
      ? await query.eq('athlete_id', Number(athleteIdParam))
      : await query;
    if (error) throw error;

    const all = (athletes ?? []) as AthleteRow[];
    const candidates = force
      ? all.filter((a) => !!a.refresh_token)
      : all.filter(
          (a) =>
            !!a.refresh_token &&
            isExpiringSoon(a.expires_at ?? null, EFFECTIVE_BUFFER_MS)
        );

    const results: Array<{
      athlete_id: number;
      status: 'refreshed' | 'skipped' | 'failed';
      message?: string;
    }> = [];

    for (const row of candidates) {
      try {
        const updated = await refreshTokenFor(
          row,
          STRAVA_CLIENT_ID,
          STRAVA_CLIENT_SECRET
        );
        if (!updated) {
          results.push({
            athlete_id: row.athlete_id,
            status: 'skipped',
            message: 'No refresh_token',
          });
          continue;
        }
        const { error: upErr } = await supabase
          .from('athletes')
          .update({
            access_token: updated.access_token,
            refresh_token: updated.refresh_token ?? row.refresh_token,
            expires_at: updated.expires_at,
            updated_at: new Date().toISOString(),
          })
          .eq('athlete_id', row.athlete_id);
        if (upErr) throw upErr;
        results.push({ athlete_id: row.athlete_id, status: 'refreshed' });
      } catch (e) {
        results.push({
          athlete_id: row.athlete_id,
          status: 'failed',
          message: String(e),
        });
      }
    }

    return new Response(
      JSON.stringify({
        count: results.length,
        total_athletes: (athletes ?? []).length,
        candidates_count: candidates.length,
        force,
        buffer_ms: EFFECTIVE_BUFFER_MS,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
