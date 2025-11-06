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
        </div>
      </body>
    </html>
  );
}
