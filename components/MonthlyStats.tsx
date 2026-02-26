'use client';

import { useMemo, useState } from 'react';

export type MonthlyRunner = {
  athlete_id: number;
  athlete_name: string;
  profile: string | null;
  runs: number;
  total_distance_km: number;
  max_distance_km: number;
  total_run_time_hms: string;
  average_run_time_mins: number;
  average_pace_min_per_km: number;
  best_pace_min_per_km: number;
  last_run: string | null;
};

export type MonthData = {
  month: string; // "YYYY-MM"
  label: string; // "February 2026"
  runners: MonthlyRunner[];
};

type Props = { data: MonthData[] };

type SortKey = keyof MonthlyRunner;

export default function MonthlyStats({ data }: Props) {
  const [activeMonth, setActiveMonth] = useState<string>(
    data.length > 0 ? data[0].month : ''
  );
  const [sortKey, setSortKey] = useState<SortKey>('runs');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Format minutes-per-kilometer (decimal minutes) into m:ss per km
  const formatPace = (decimalMinutes: number): string => {
    if (!decimalMinutes || decimalMinutes <= 0) return '-';
    const mins = Math.floor(decimalMinutes);
    const secs = Math.round((decimalMinutes - mins) * 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
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
          background: '#d1d5db',
          border: '1px solid #2a3345',
          overflow: 'hidden',
          flex: '0 0 auto',
        }}
        aria-label={alt}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1f2937',
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
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null}
      </span>
    );
  };

  if (data.length === 0) return null;

  const activeData = data.find((d) => d.month === activeMonth);

  const sorted = useMemo(() => {
    if (!activeData) return [];
    // Assign positions based on runs desc, then distance desc
    const ranked = [...activeData.runners].sort(
      (a, b) => b.runs - a.runs || b.total_distance_km - a.total_distance_km
    );
    const withPos = ranked.map((r, idx) => ({ ...r, position: idx + 1 }));
    // Now sort by chosen key
    return [...withPos].sort((a, b) => {
      const va = a[sortKey as keyof typeof a];
      const vb = b[sortKey as keyof typeof b];
      if (typeof va === 'number' && typeof vb === 'number')
        return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc'
        ? String(va ?? '').localeCompare(String(vb ?? ''))
        : String(vb ?? '').localeCompare(String(va ?? ''));
    });
  }, [activeData, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'athlete_name' ? 'asc' : 'desc');
    }
  };

  const Header = ({
    label,
    keyName,
    title,
    style,
  }: {
    label: string;
    keyName: SortKey;
    title?: string;
    style?: React.CSSProperties;
  }) => (
    <th
      onClick={() => toggleSort(keyName)}
      title={title}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        textAlign: 'center',
        ...style,
      }}
    >
      {label} {sortKey === keyName ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>📅 Monthly Breakdown</h2>

      {/* Month tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        {data.map((m) => (
          <button
            key={m.month}
            onClick={() => setActiveMonth(m.month)}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 8,
              border:
                activeMonth === m.month
                  ? '2px solid #fc4c02'
                  : '1px solid #2a3345',
              background: activeMonth === m.month ? '#1e2952' : '#121832',
              color: activeMonth === m.month ? '#fc4c02' : '#9aa3b2',
              fontWeight: activeMonth === m.month ? 700 : 400,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Active month table */}
      {sorted.length > 0 ? (
        <div style={{ padding: 0 }}>
          <table style={{ width: '100%', textAlign: 'center' }}>
            <thead>
              <tr>
                <Header label="Pos" keyName="runs" />
                <Header label="Athlete" keyName="athlete_name" />
                <Header label="Runs" keyName="runs" />
                <Header label="Total km" keyName="total_distance_km" />
                <Header label="Max km" keyName="max_distance_km" />
                <Header label="Total Time" keyName="total_run_time_hms" />
                <Header label="Avg Run" keyName="average_run_time_mins" title="Average run time in minutes" />
                <Header label="Avg Pace" keyName="average_pace_min_per_km" title="Average pace (min:sec per km)" />
                <Header label="Best Pace" keyName="best_pace_min_per_km" title="Best pace (min:sec per km)" />
                <Header label="Last Run" keyName="last_run" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
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
                    <Avatar src={row.profile} alt={row.athlete_name} />
                    <span>{row.athlete_name}</span>
                  </td>
                  <td>{row.runs}</td>
                  <td>{row.total_distance_km.toFixed(2)}</td>
                  <td>{row.max_distance_km.toFixed(2)}</td>
                  <td>{row.total_run_time_hms}</td>
                  <td>{row.average_run_time_mins.toFixed(1)}</td>
                  <td>{formatPace(row.average_pace_min_per_km)}</td>
                  <td>{formatPace(row.best_pace_min_per_km)}</td>
                  <td>
                    {row.last_run
                      ? (() => {
                          const d = new Date(row.last_run);
                          return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
                        })()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ color: '#9aa3b2' }}>
          No runs recorded this month.
        </div>
      )}
    </div>
  );
}
