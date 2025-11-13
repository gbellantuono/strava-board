import LeaderboardTable, { AthleteStats } from '@/components/LeaderboardTable';
import Countdown from '@/components/Countdown';
import LoginButton from '@/components/LoginButton';
import LogoutButton from '@/components/LogoutButton';
import { headers, cookies } from 'next/headers';

async function getLeaderboard(): Promise<{
  ok: boolean;
  data?: AthleteStats[];
}> {
  // Server Component fetch to API route. Avoid caching.
  const base = await getBaseUrl();
  const defaultAfter = process.env.NEXT_PUBLIC_START_DATE || '2025-10-26';
  const urlObj = new URL('/api/leaderboard', base);
  if (defaultAfter) urlObj.searchParams.set('after', defaultAfter);
  const url = urlObj.toString();
  const hs = await headers();
  const res = await fetch(url, {
    cache: 'no-store',
    // Forward the incoming request cookies so API route can read auth cookie
    headers: {
      accept: 'application/json',
      cookie: hs.get('cookie') ?? '',
    },
  });
  if (!res.ok) return { ok: false };
  return { ok: true, data: (await res.json()) as AthleteStats[] };
}

async function getBaseUrl(): Promise<string> {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase && /^https?:\/\//.test(envBase))
    return envBase.replace(/\/$/, '');
  const hs = await headers();
  const host = hs.get('host');
  if (!host) return '';
  const isProd =
    !!process.env.VERCEL_URL || process.env.NODE_ENV === 'production';
  const protocol = isProd ? 'https' : 'http';
  return `${protocol}://${host}`;
}
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[]>>;
}) {
  const cks = await cookies();
  const isLoggedIn = !!cks.get('strava_access_token');
  const params = await searchParams;
  const errorParam =
    typeof params?.error === 'string' ? params?.error : undefined;
  // Only fetch leaderboard when logged in and no error redirect present
  const result =
    isLoggedIn && !errorParam ? await getLeaderboard() : { ok: false };

  return (
    <main>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          margin: '0 0 1rem 0',
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0 }}>🏃‍♂️ VEC Running Leaderboard</h1>
        <Countdown />
      </div>

      {!isLoggedIn ? (
        <>
          {errorParam ? (
            <div
              className="card"
              style={{
                marginBottom: '1rem',
                border: '1px solid #b91c1c',
                background: '#7f1d1d',
                color: '#fee2e2',
              }}
            >
              {errorParam === 'not_in_club'
                ? 'Your Strava account is not a member of the required club.'
                : errorParam === 'invalid_club_id'
                ? 'The club is misconfigured. Please contact the admin.'
                : 'Could not verify your club membership. Please try again later.'}
            </div>
          ) : null}
          <p style={{ color: '#9aa3b2', marginBottom: '1.5rem' }}>
            Connect with Strava to fetch your club activities and see the
            leaderboard.
          </p>
          <LoginButton />
        </>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: '1rem',
            }}
          >
            <LogoutButton />
          </div>
          {errorParam ? (
            <div
              className="card"
              style={{
                marginBottom: '1rem',
                border: '1px solid #b91c1c',
                background: '#7f1d1d',
                color: '#fee2e2',
              }}
            >
              {errorParam === 'not_in_club'
                ? 'Your Strava account is not a member of the required club.'
                : errorParam === 'invalid_club_id'
                ? 'The club is misconfigured. Please contact the admin.'
                : 'Could not verify your club membership. Please try again later.'}
            </div>
          ) : result.ok && result.data && result.data.length > 0 ? (
            <LeaderboardTable data={result.data} />
          ) : (
            <div className="card">
              No running activities found yet. Try again later.
            </div>
          )}
        </>
      )}
    </main>
  );
}
