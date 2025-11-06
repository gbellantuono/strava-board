# 🏃‍♂️ VEC Strava Leaderboard

Next.js App Router app that signs in with Strava (OAuth2), fetches club activities, and displays a sortable leaderboard for runs.

## Requirements

- Node.js 18+ (LTS recommended)
- A Strava API application (Client ID/Secret)

## Environment

Create `.env.local` from `.env.example` and fill in your values:

```
STRAVA_CLIENT_ID=your_id
STRAVA_CLIENT_SECRET=your_secret
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/strava/callback
STRAVA_CLUB_ID=your_club_id (numeric id, not the slug)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (server-side only)
```

Optionally, set `NEXT_PUBLIC_BASE_URL` during development if needed (e.g. reverse proxy). Otherwise it defaults to relative fetch.

## Run locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000 and click "Login with Strava".

## Deploy

Deploy on Vercel. Set the same env vars in the Vercel dashboard, and update:

```
STRAVA_REDIRECT_URI=https://<your-app-name>.vercel.app/api/auth/strava/callback
```

## Notes

- Tokens are stored in an HTTP-only cookie: `strava_access_token`.
- The leaderboard aggregates runs per athlete. It can use `/athlete/activities` via tokens stored in DB for date-aware computations.
- Sorting is client-side and can be changed by clicking column headers.

### Finding your STRAVA_CLUB_ID

You need the numeric club id (not the slug). Quick ways:

- After logging in locally, open: http://localhost:3000/api/debug/clubs — this returns your clubs with their numeric ids.
- Or visit your club page on strava.com and inspect network calls; ids often appear in API requests.

If `/api/leaderboard` returns 404 from Strava, double-check:

- STRAVA_CLUB_ID is numeric and correct
- Your authorized athlete account is a member of that club (private clubs require membership to read activities)

### Database schema (Supabase)

Create a table to store athlete tokens:

```sql
create table if not exists public.athletes (
	athlete_id bigint primary key,
	firstname text,
	lastname text,
	username text,
	profile text,
	access_token text,
	refresh_token text,
	expires_at timestamptz,
	updated_at timestamptz default now()
);
```

The OAuth callback upserts into `public.athletes`. The leaderboard reads athletes from the DB, refreshes expired tokens automatically, and calls `/athlete/activities` (which includes `start_date`) to compute stats.
