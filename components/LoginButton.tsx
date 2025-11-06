'use client';

export default function LoginButton() {
  return (
    <a href="/api/auth/strava" aria-label="Login with Strava">
      <button
        type="button"
        style={{
          background: '#fc4c02',
          color: '#fff',
          fontWeight: 600,
          padding: '0.75rem 1.25rem',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          letterSpacing: '0.5px',
        }}
      >
        Connect with Strava
      </button>
    </a>
  );
}
