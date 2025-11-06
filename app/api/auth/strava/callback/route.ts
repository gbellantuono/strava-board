import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.STRAVA_CLIENT_ID!;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!;
const REDIRECT_URI = process.env.STRAVA_REDIRECT_URI!;

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number; // epoch seconds
  athlete?: {
    id: number;
    firstname?: string;
    lastname?: string;
    username?: string;
    profile?: string;
  };
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  if (!code) {
    return NextResponse.json(
      { error: 'Missing authorization code' },
      { status: 400 }
    );
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Token exchange failed: ${text}` },
      { status: res.status }
    );
  }

  const json = (await res.json()) as TokenResponse;

  // Persist or update athlete tokens in Supabase
  try {
    const { supabase } = await import('../../../../../lib/supabase');
    if (json.athlete?.id) {
      const expiresAt = json.expires_at
        ? new Date(json.expires_at * 1000)
        : null;
      const { error } = await supabase.from('athletes').upsert(
        {
          athlete_id: json.athlete.id,
          firstname: json.athlete.firstname ?? null,
          lastname: json.athlete.lastname ?? null,
          username: json.athlete.username ?? null,
          profile: json.athlete.profile ?? null,
          access_token: json.access_token,
          refresh_token: json.refresh_token ?? null,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'athlete_id' }
      );
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Supabase upsert error:', error);
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Supabase not configured or failed to save athlete:', e);
  }

  const redirect = NextResponse.redirect(new URL('/', req.url));
  const expires = json.expires_at
    ? new Date(json.expires_at * 1000)
    : undefined;
  const isHttps = new URL(req.url).protocol === 'https:';
  console.log('json message ', json);
  redirect.cookies.set('strava_access_token', json.access_token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    expires,
  });
  return redirect;
}
