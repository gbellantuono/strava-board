'use client';

import { useMemo, useState } from 'react';

export type AthleteStats = {
  athlete_id: number;
  athlete_name: string;
  position: number;
  medal: 'gold' | 'silver' | 'bronze' | null;
  profile: string | null;
  total_runs: number;
  total_distance_km: number;
  max_distance_km: number;
  total_run_time_hms: string;
  average_run_time_mins: number;
  average_pace_min_per_km: number;
  best_pace_min_per_km: number;
  last_run: string | null; // ISO
};

type Props = {
  competition: AthleteStats[];
  thisMonth: AthleteStats[];
};

type SortKey = keyof AthleteStats;
type ViewMode = 'competition' | 'thisMonth';

export default function LeaderboardTable({ competition, thisMonth }: Props) {
  const [view, setView] = useState<ViewMode>('thisMonth');
  const [sortKey, setSortKey] = useState<SortKey>('total_runs');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const data = view === 'competition' ? competition : thisMonth;
  const groupLabel =
    view === 'competition'
      ? 'Start of Competition (Oct 2025)'
      : 'This Month';

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
          {letter || '\u00b7'}
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
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
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
    <th role="button" onClick={() => onHeaderClick(keyName)} title={title} style={style}>
      {label} {sortKey === keyName ? (sortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}
    </th>
  );

  const groupBorder = '1px solid rgba(255, 255, 255, 0.61)';
  const groupBg = 'rgba(255,255,255,0.02)';
  const groupHeaderStyle: React.CSSProperties = {
    textAlign: 'center',
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '0.4rem 1rem',
    borderTop: groupBorder,
    borderLeft: groupBorder,
    borderRight: groupBorder,
  };

  const toggleBtnBase: React.CSSProperties = {
    padding: '0.4rem 1rem',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 14,
  };

  return (
    <div>
      {/* Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <button
          onClick={() => { setView('thisMonth'); setSortKey('total_runs'); setSortDir('desc'); }}
          style={{
            ...toggleBtnBase,
            background: view === 'thisMonth' ? '#1e2952' : '#121832',
            color: view === 'thisMonth' ? '#ffffff' : '#9aa3b2',
            border: view === 'thisMonth' ? '2px solid #ffffff' : '1px solid #2a3345',
          }}
        >
          This Month
        </button>
        <button
          onClick={() => { setView('competition'); setSortKey('total_runs'); setSortDir('desc'); }}
          style={{
            ...toggleBtnBase,
            background: view === 'competition' ? '#1e2952' : '#121832',
            color: view === 'competition' ? '#ffffff' : '#9aa3b2',
            border: view === 'competition' ? '2px solid #ffffff' : '1px solid #2a3345',
          }}
        >
          Start of Competition
        </button>
      </div>

      {data.length === 0 ? (
        <div className="card" style={{ color: '#9aa3b2' }}>
          No running activities recorded for this period yet.
        </div>
      ) : (
      <div style={{ padding: 0 }}>
        <table style={{ width: '100%', textAlign: 'center' }}>
          <thead>
            <tr>
              <th
                colSpan={10}
                style={{
                  ...groupHeaderStyle,
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                }}
              >
                {groupLabel}
              </th>
            </tr>
            <tr>
              <Header label="Pos" keyName="position" style={{ borderLeft: groupBorder }} />
              <Header label="Athlete" keyName="athlete_name" />
              <Header label="Runs" keyName="total_runs" />
              <Header label="Total km" keyName="total_distance_km" />
              <Header label="Max km" keyName="max_distance_km" />
              <Header label="Total Time" keyName="total_run_time_hms" />
              <Header label="Avg Run" keyName="average_run_time_mins" title="Average run time in minutes" />
              <Header label="Avg Pace" keyName="average_pace_min_per_km" title="Average pace (min:sec per km)" />
              <Header label="Best Pace" keyName="best_pace_min_per_km" title="Best pace (min:sec per km)" />
              <Header label="Last Run" keyName="last_run" style={{ borderRight: groupBorder }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row: AthleteStats, rowIdx: number) => {
              const isLast = rowIdx === sorted.length - 1;
              return (
              <tr key={row.athlete_id}>
                <td style={{ borderLeft: groupBorder, background: groupBg, ...(isLast ? { borderBottom: groupBorder, borderBottomLeftRadius: 8 } : {}) }}>
                  {row.position <= 3
                    ? row.position === 1
                      ? '\ud83e\udd47'
                      : row.position === 2
                      ? '\ud83e\udd48'
                      : '\ud83e\udd49'
                    : row.position}
                </td>
                <td
                  style={{
                    background: groupBg,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    ...(isLast ? { borderBottom: groupBorder } : {}),
                  }}
                >
                  <Avatar src={row.profile ?? undefined} alt={row.athlete_name} />
                  <span>{row.athlete_name}</span>
                </td>
                <td style={{ background: groupBg, ...(isLast ? { borderBottom: groupBorder } : {}) }}>{row.total_runs}</td>
                <td style={{ background: groupBg, ...(isLast ? { borderBottom: groupBorder } : {}) }}>{row.total_distance_km.toFixed(2)}</td>
                <td style={{ background: groupBg, ...(isLast ? { borderBottom: groupBorder } : {}) }}>{row.max_distance_km.toFixed(2)}</td>
                <td style={{ background: groupBg, ...(isLast ? { borderBottom: groupBorder } : {}) }}>{row.total_run_time_hms}</td>
                <td style={{ background: groupBg, ...(isLast ? { borderBottom: groupBorder } : {}) }}>{row.average_run_time_mins.toFixed(1)}</td>
                <td style={{ background: groupBg, ...(isLast ? { borderBottom: groupBorder } : {}) }}>{formatPace(row.average_pace_min_per_km)}</td>
                <td style={{ background: groupBg, ...(isLast ? { borderBottom: groupBorder } : {}) }}>{formatPace(row.best_pace_min_per_km)}</td>
                <td style={{ borderRight: groupBorder, background: groupBg, ...(isLast ? { borderBottom: groupBorder, borderBottomRightRadius: 8 } : {}) }}>
                  {row.last_run
                    ? (() => { const d = new Date(row.last_run); return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`; })()
                    : '-'}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
