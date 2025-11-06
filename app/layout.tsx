import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VEC Strava Leaderboard',
  description: 'Leaderboard for VEC Strava club built with Next.js',
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
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
          {children}
          <footer
            style={{
              marginTop: '2rem',
              fontSize: '0.8rem',
              opacity: 0.7,
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
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
                {/* If you add /public/strava-logo.png or .svg, it will render here */}
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
              This private club leaderboard aggregates run statistics and
              adheres to the{' '}
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
        </div>
      </body>
    </html>
  );
}
