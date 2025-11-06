# 🏃‍♂️ VEC Strava Leaderboard

## 📌 Goal

Build a **Next.js 16** web app (App Router) that displays a leaderboard for runners in the **VEC Strava club**. The app fetches data via the **Strava API**, using **OAuth2 login**, and **Next.js API routes only** (no external backend, no database).

---

## ✅ App Features

- ✅ Strava OAuth login (server-side OAuth flow)
- ✅ Fetch club members and activities from Strava `/clubs/{club_id}/activities`
- ✅ Process and filter only runs
- ✅ Compute leaderboard metrics per athlete:
  - `total_runs`
  - `total_distance_km`
  - `max_distance_km`
  - `total_run_time_hms`
  - `average_run_time_mins`
  - `average_pace_min_per_km`
- ✅ Display sortable leaderboard (e.g. by total distance or average pace)
- ✅ Use environment variables for auth and secrets
- ✅ Deployed for free on Vercel

---

## 🧱 Folder Structure

/app
/page.tsx → Home page UI
/api
/auth/strava/route.ts → Redirect to Strava OAuth
/auth/strava/callback/route.ts → OAuth callback and token exchange
/leaderboard/route.ts → Fetches and computes leaderboard JSON
/lib
/strava.ts → Helper wrappers for Strava API calls (optional)
/components
/LeaderboardTable.tsx → React component for leaderboard UI
/LoginButton.tsx → Button that triggers Strava auth

yaml
Copy code

---

## 🔐 Environment Variables (`.env.local`)

STRAVA_CLIENT_ID=your_id
STRAVA_CLIENT_SECRET=your_secret
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/strava/callback
STRAVA_CLUB_ID=your_strava_club_id

yaml
Copy code

---

## 🔁 OAuth Flow

1. User clicks "Login with Strava"
2. Redirect to Strava OAuth
3. Strava redirects to `/api/auth/strava/callback` with `code`
4. We exchange code for `access_token` server-side (use fetch)
5. Token is stored in **HTTP-only cookie**
6. `/api/leaderboard` uses token to fetch data and return stats
7. Client UI (`page.tsx`) calls `/api/leaderboard` and renders table

---

## 🚀 Deployment

Deploy using **Vercel**, add environment variables in the Vercel dashboard.  
Ensure `STRAVA_REDIRECT_URI` is updated to:

https://<your-app-name>.vercel.app/api/auth/strava/callback

yaml
Copy code

---

## Notes for Copilot:

- Use TypeScript throughout
- Use `fetch()` for Strava API requests
- Keep client_secret **server-side only**
- Use `NextResponse` and `NextRequest` in API routes
- Use `cookies()` from `next/headers` for token storage
- Frontend should render from dynamic fetch of `/api/leaderboard`
