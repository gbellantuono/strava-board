import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.STRAVA_CLIENT_ID!;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET!;
const REDIRECT_URI = process.env.STRAVA_REDIRECT_URI!;
const CLUB_ID = process.env.STRAVA_CLUB_ID;

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

  // Optional: enforce club membership before setting cookie or storing tokens
  if (CLUB_ID) {
    // Validate configured club id
    const trimmed = String(CLUB_ID).trim();
    const requiredId = Number(trimmed);
    if (Number.isNaN(requiredId)) {
      // Misconfigured CLUB_ID - deny login for safety
      // eslint-disable-next-line no-console
      console.warn('STRAVA_CLUB_ID is not a valid number:', CLUB_ID);
      return NextResponse.redirect(new URL('/?error=invalid_club_id', req.url));
    }

    try {
      const clubsRes = await fetch(
        'https://www.strava.com/api/v3/athlete/clubs',
        {
          headers: { Authorization: `Bearer ${json.access_token}` },
          cache: 'no-store',
        }
      );

      // If Strava returns a non-OK response, treat it as a failed membership check
      const raw = await clubsRes.text();
      if (!clubsRes.ok) {
        // eslint-disable-next-line no-console
        console.warn('athlete/clubs returned non-OK', clubsRes.status, raw);
        return NextResponse.redirect(
          new URL('/?error=club_check_failed', req.url)
        );
      }

      let clubs: Array<{ id?: number | string }> | null = null;
      try {
        clubs = JSON.parse(raw) as Array<{ id?: number | string }>;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to parse clubs response:', e, raw);
        return NextResponse.redirect(
          new URL('/?error=club_check_failed', req.url)
        );
      }

      if (!Array.isArray(clubs)) {
        // eslint-disable-next-line no-console
        console.warn('clubs response is not an array:', raw);
        return NextResponse.redirect(
          new URL('/?error=club_check_failed', req.url)
        );
      }

      const isMember = clubs.some((c) => {
        if (c == null) return false;
        const cid = Number(c.id);
        return !Number.isNaN(cid) && cid === requiredId;
      });

      if (!isMember) {
        // Optionally deauthorize token here (not required). Redirect with error.
        return NextResponse.redirect(new URL('/?error=not_in_club', req.url));
      }
    } catch (err) {
      // If membership check fails unexpectedly, fall back to denying login for safety
      // eslint-disable-next-line no-console
      console.error('Club membership check failed:', err);
      return NextResponse.redirect(
        new URL('/?error=club_check_failed', req.url)
      );
    }
  }

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
