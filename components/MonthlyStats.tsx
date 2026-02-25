'use client';

import { useState } from 'react';

export type MonthlyRunner = {
  athlete_id: number;
  athlete_name: string;
  profile: string | null;
  runs: number;
  total_distance_km: number;
  total_time_hms: string;
};

export type MonthData = {
  month: string; // "YYYY-MM"
  label: string; // "February 2026"
  runners: MonthlyRunner[];
};

type Props = { data: MonthData[] };

export default function MonthlyStats({ data }: Props) {
  // Most recent month is active by default
  const [activeMonth, setActiveMonth] = useState<string>(
    data.length > 0 ? data[0].month : ''
  );

  if (data.length === 0) return null;

  const Avatar = ({
    src,
    alt,
    size = 24,
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

  const activeData = data.find((d) => d.month === activeMonth);

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

      {/* Active month card */}
      {activeData && activeData.runners.length > 0 ? (
        <div
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
        >
          {activeData.runners.map((runner, idx) => (
            <div
              key={runner.athlete_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0.65rem 0.5rem',
                borderTop: idx > 0 ? '1px solid #1e2952' : undefined,
              }}
            >
              {/* Position */}
              <span
                style={{
                  width: 28,
                  textAlign: 'center',
                  fontWeight: 700,
                  color:
                    idx === 0
                      ? '#fbbf24'
                      : idx === 1
                      ? '#d1d5db'
                      : idx === 2
                      ? '#d97706'
                      : '#9aa3b2',
                  fontSize: 15,
                }}
              >
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
              </span>

              {/* Avatar + Name */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <Avatar src={runner.profile} alt={runner.athlete_name} />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 14,
                  }}
                >
                  {runner.athlete_name}
                </span>
              </div>

              {/* Stats */}
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  alignItems: 'center',
                  flexShrink: 0,
                  fontSize: 13,
                  color: '#9aa3b2',
                }}
              >
                <span title="Active days (runs)">
                  <strong style={{ color: '#e7eaf2' }}>{runner.runs}</strong>{' '}
                  runs
                </span>
                <span title="Total distance">
                  {runner.total_distance_km.toFixed(1)} km
                </span>
                <span title="Total time" style={{ fontFamily: 'monospace' }}>
                  {runner.total_time_hms}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ color: '#9aa3b2' }}>
          No runs recorded this month.
        </div>
      )}
    </div>
  );
}
