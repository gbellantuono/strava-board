'use client';

import { useMemo, useState } from 'react';

export type AthleteStats = {
  athlete_id: number;
  athlete_name: string;
  total_runs: number;
  total_distance_km: number;
  max_distance_km: number;
  total_run_time_hms: string;
  average_run_time_mins: number;
  average_pace_min_per_km: number;
  first_activity_date?: string;
  last_activity_date?: string;
};

type Props = { data: AthleteStats[] };

type SortKey = keyof AthleteStats;

export default function LeaderboardTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total_distance_km');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  const Header = ({ label, keyName }: { label: string; keyName: SortKey }) => (
    <th role="button" onClick={() => onHeaderClick(keyName)}>
      {label} {sortKey === keyName ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <Header label="Athlete" keyName="athlete_name" />
            <Header label="Runs" keyName="total_runs" />
            <Header label="Total km" keyName="total_distance_km" />
            <Header label="Max km" keyName="max_distance_km" />
            <Header label="Total time" keyName="total_run_time_hms" />
            <Header label="Avg run (min)" keyName="average_run_time_mins" />
            <Header
              label="Avg pace (min/km)"
              keyName="average_pace_min_per_km"
            />
            <th>First run</th>
            <th>Last run</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row: AthleteStats) => (
            <tr key={row.athlete_id}>
              <td>{row.athlete_name}</td>
              <td>{row.total_runs}</td>
              <td>{row.total_distance_km.toFixed(2)}</td>
              <td>{row.max_distance_km.toFixed(2)}</td>
              <td>{row.total_run_time_hms}</td>
              <td>{row.average_run_time_mins.toFixed(1)}</td>
              <td>{row.average_pace_min_per_km.toFixed(2)}</td>
              <td>
                {row.first_activity_date
                  ? row.first_activity_date.slice(0, 10)
                  : '-'}
              </td>
              <td>
                {row.last_activity_date
                  ? row.last_activity_date.slice(0, 10)
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
