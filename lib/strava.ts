export type StravaActivity = {
  id: number;
  name: string;
  type?: string; // legacy activity type, e.g., 'Run', 'Ride'
  sport_type?: string; // newer field, e.g., 'Run', 'TrailRun', 'VirtualRun'
  start_date?: string; // ISO UTC
  start_date_local?: string; // ISO local
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  athlete: {
    id: number;
    firstname?: string;
    lastname?: string;
    name?: string;
  };
};

export async function stravaFetch<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const url = `https://www.strava.com/api/v3${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava API error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export function hms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
