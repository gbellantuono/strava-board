import { supabase } from './supabase';

const CLIENT_ID = process.env.STRAVA_CLIENT_ID!;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!;

export type AthleteRow = {
  athlete_id: number;
  firstname?: string | null;
  lastname?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null; // ISO string or null
};

type RefreshResponse = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number; // epoch seconds
};

export async function ensureAccessToken(
  row: AthleteRow
): Promise<string | null> {
  const now = Date.now();
  const expiry = row.expires_at ? new Date(row.expires_at).getTime() : null;
  const bufferMs = 60 * 1000; // 1 minute buffer

  if (row.access_token && expiry && expiry - bufferMs > now) {
    return row.access_token;
  }

  if (!row.refresh_token) return row.access_token ?? null;

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: row.refresh_token,
  });

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });
  if (!res.ok) return row.access_token ?? null;
  const json = (await res.json()) as RefreshResponse;
  const expiresAtIso = json.expires_at
    ? new Date(json.expires_at * 1000).toISOString()
    : null;

  await supabase
    .from('athletes')
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? row.refresh_token,
      expires_at: expiresAtIso,
      updated_at: new Date().toISOString(),
    })
    .eq('athlete_id', row.athlete_id);

  return json.access_token;
}
