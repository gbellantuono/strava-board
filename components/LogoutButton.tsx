'use client';

export default function LogoutButton() {
  return (
    <a href="/api/auth/logout">
      <button aria-label="Logout from Strava" style={{ background: '#1e2952' }}>
        Logout
      </button>
    </a>
  );
}
