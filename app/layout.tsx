import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VEC Running Leaderboard',
  description: 'Leaderboard for VEC running club members using Strava data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          background: '#0b1020',
          color: '#e7eaf2',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
            {children}
          </div>
        </div>
        <footer
          style={{
            fontSize: '0.8rem',
            opacity: 0.7,
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
            padding: '1rem 1.25rem',
            borderTop: '1px solid #182030',
            marginTop: 'auto',
          }}
        >
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Data powered by
            <a
              href="https://www.strava.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#fc4c02',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <img
                src="/strava-logo.svg"
                alt="Strava"
                width={80}
                height={16}
                style={{ display: 'inline-block', verticalAlign: 'middle' }}
              />
            </a>
            .
          </span>
          <span>
            This private club leaderboard adheres to the{' '}
            <a
              href="https://developers.strava.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#9aa3b2' }}
            >
              Strava API Guidelines
            </a>
            .
          </span>
        </footer>
      </body>
    </html>
  );
}
