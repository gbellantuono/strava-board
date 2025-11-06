import LeaderboardTable, { AthleteStats } from '@/components/LeaderboardTable';
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
export default async function Page() {
  const result = await getLeaderboard();
  const cks = await cookies();
  const isLoggedIn = !!cks.get('strava_access_token');

  return (
    <main>
      <h1 style={{ margin: '0 0 1rem 0' }}>🏃‍♂️ VEC Running Leaderboard</h1>

      {!isLoggedIn ? (
        <>
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
          {result.data && result.data.length > 0 ? (
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
