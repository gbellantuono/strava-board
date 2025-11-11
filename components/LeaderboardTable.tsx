'use client';

import { useMemo, useState } from 'react';

export type AthleteStats = {
  athlete_id: number;
  athlete_name: string;
  position: number;
  medal: 'gold' | 'silver' | 'bronze' | null;
  profile: string | null;
  total_runs: number;
  projected_runs: number;
  total_distance_km: number;
  max_distance_km: number;
  total_run_time_hms: string;
  average_run_time_mins: number;
  average_pace_min_per_km: number;
  best_pace_min_per_km: number;
  last_run: string | null; // ISO
};

type Props = { data: AthleteStats[] };

type SortKey = keyof AthleteStats;

export default function LeaderboardTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('position');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Format minutes-per-kilometer (decimal minutes) into m:ss per km
  const formatPace = (minPerKm: number) => {
    if (!isFinite(minPerKm) || minPerKm <= 0) return '-';
    const totalSeconds = Math.round(minPerKm * 60);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const Avatar = ({
    src,
    alt,
    size = 28,
  }: {
    src?: string | null;
    alt: string;
    size?: number;
  }) => {
    const letter = (alt || '?').trim().charAt(0).toUpperCase();
    return (
      <span
        style={{
          position: 'relative',
          width: size,
          height: size,
          display: 'inline-block',
          borderRadius: '50%',
          background: '#d1d5db', // gray-300 fallback when no image
          border: '1px solid #2a3345',
          overflow: 'hidden',
          flex: '0 0 auto',
        }}
        aria-label={alt}
      >
        {/* Fallback initial letter centered */}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1f2937', // gray-800
            fontSize: Math.max(10, Math.floor(size * 0.5)),
            fontWeight: 600,
            userSelect: 'none',
          }}
          aria-hidden={!!src}
        >
          {letter || '·'}
        </span>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            width={size}
            height={size}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              // Hide the image if it fails to load so the gray background shows
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null}
      </span>
    );
  };

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const va = a[sortKey] as unknown as number | string;
      const vb = b[sortKey] as unknown as number | string;
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      const na = Number(va);
      const nb = Number(vb);
      return sortDir === 'asc' ? na - nb : nb - na;
    });
    return copy;
  }, [data, sortDir, sortKey]);

  const onHeaderClick = (key: SortKey) => {
    if (key === sortKey)
      setSortDir((d: 'asc' | 'desc') => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const Header = ({
    label,
    keyName,
    title,
  }: {
    label: string;
    keyName: SortKey;
    title?: string;
  }) => (
    <th role="button" onClick={() => onHeaderClick(keyName)} title={title}>
      {label} {sortKey === keyName ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );

  return (
    <div className="card">
      <table style={{ width: '100%', textAlign: 'center' }}>
        <thead>
          <tr>
            <Header label="Pos" keyName="position" />
            <Header label="Athlete" keyName="athlete_name" />
            <Header label="Runs" keyName="total_runs" />
            <Header
              label="Projection"
              keyName="projected_runs"
              title="Projection uses weekly consistency from the challenge start: it estimates future active weeks from your active‑week rate and multiplies by runs per active week."
            />
            <Header label="Total km" keyName="total_distance_km" />
            <Header label="Max km" keyName="max_distance_km" />
            <Header label="Total time" keyName="total_run_time_hms" />
            <Header label="Avg run (min)" keyName="average_run_time_mins" />
            <Header
              label="Avg pace (m:ss/km)"
              keyName="average_pace_min_per_km"
            />
            <Header
              label="Best pace (m:ss/km)"
              keyName="best_pace_min_per_km"
            />
            <Header label="Last run" keyName="last_run" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row: AthleteStats) => (
            <tr key={row.athlete_id}>
              <td>
                {row.position <= 3
                  ? row.position === 1
                    ? '🥇'
                    : row.position === 2
                    ? '🥈'
                    : '🥉'
                  : row.position}
              </td>
              <td
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                }}
              >
                <Avatar src={row.profile ?? undefined} alt={row.athlete_name} />
                <span>{row.athlete_name}</span>
              </td>
              <td>{row.total_runs}</td>
              <td>{row.projected_runs}</td>
              <td>{row.total_distance_km.toFixed(2)}</td>
              <td>{row.max_distance_km.toFixed(2)}</td>
              <td>{row.total_run_time_hms}</td>
              <td>{row.average_run_time_mins.toFixed(1)}</td>
              <td>{formatPace(row.average_pace_min_per_km)}</td>
              <td>{formatPace(row.best_pace_min_per_km)}</td>
              <td>
                {row.last_run
                  ? new Date(row.last_run).toISOString().slice(0, 10) // YYYY-MM-DD (stable, UTC)
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
