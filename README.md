# 🏃‍♂️ VEC Strava Leaderboard

Next.js App Router app that signs in with Strava (OAuth2), fetches club activities, and displays a sortable leaderboard for runs.

> Strava data usage: This application uses the Strava API to access authenticated athletes’ run activities for aggregation. It is for members of the configured Strava club only and is not intended to replicate or compete with core Strava functionality. All data shown belongs to the logged‑in athlete or other club members strictly within the context of this private club leaderboard.

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

### Strava API Compliance

You must comply with Strava’s API Brand Guidelines and display the provided Strava logos and links where Strava data is used. Suggested placement: footer with a “Data powered by Strava” acknowledgment linking to https://www.strava.com.

Key compliance points this app follows / aims to follow:

- Purpose: Provide a simple, private club‑only leaderboard (inspiring, community‑oriented; not replicating broader Strava features).
- Non‑competition: Does not attempt to replace Strava; only aggregates simple stats (runs count, distance, pace) for the club.
- Visibility scope: Only authenticated club members can view the leaderboard. No public exposure of other athletes’ data outside the club context.
- Data minimization: Only basic activity fields for runs are stored/processed; no location, segment, or heart‑rate data displayed.
- Privacy: Tokens stored server‑side (Supabase), not exposed client‑side; access restricted via HTTP‑only cookie + club membership check.
- Refresh: Tokens refreshed securely via Strava OAuth refresh flow; no misuse of credentials.
- Security: Service role key held server‑side only. Recommend rotation and strict access control on Supabase project.
- Attribution: Add Strava logo + link in layout footer (see below) to meet branding requirements.
- Rate limits: Activity fetching per athlete batched and constrained; background refresh schedules should respect Strava’s API volume limits.
- Legal: Usage should remain within Strava API Agreement, Strava Terms of Service, and Privacy Policy.

### Adding Strava Attribution (Example)

Add to `app/layout.tsx` inside the `<body>` wrapper:

```tsx
<footer style={{ marginTop: '2rem', fontSize: '0.85rem', opacity: 0.7 }}>
  Data powered by{' '}
  <a
    href="https://www.strava.com"
    target="_blank"
    rel="noopener noreferrer"
    style={{ color: '#fc4c02', fontWeight: 600 }}
  >
    Strava
  </a>
  .
</footer>
```

Optionally include the official Strava logo image if guidelines allow (ensure hosting per brand rules):

```html
<img src="/strava-logo.svg" alt="Strava" height="20" />
```

### Further Hardening / Next Steps

- Add explicit consent / privacy notice modal if expanding data scope.
- Cache leaderboard results short‑term (e.g., 60s) to reduce API calls.
- Implement per‑user rate limiting in `/api/leaderboard`.
- Add error surface for `?error=not_in_club` on homepage for clearer feedback.
- Rotate and store secrets using Vercel project environment management (never commit service role keys).
