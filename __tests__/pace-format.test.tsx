import { render, screen } from '@testing-library/react';
import LeaderboardTable, { AthleteStats } from '../components/LeaderboardTable';

/**
 * @jest-environment jsdom
 */

describe('pace formatting', () => {
  it('renders decimal minute pace as m:ss', () => {
    const rows: AthleteStats[] = [
      {
        athlete_id: 1,
        athlete_name: 'Pace Test',
        position: 1,
        medal: 'gold',
        profile: null,
        total_runs: 1,
        total_distance_km: 5,
        max_distance_km: 5,
        total_run_time_hms: '00:29:59',
        average_run_time_mins: 29.98,
        average_pace_min_per_km: 5.8333, // should render 5:50
        best_pace_min_per_km: 4.5, // should render 4:30
        last_run: '2025-11-10T00:00:00.000Z',
      },
    ];

    render(<LeaderboardTable data={rows} />);
    const cells = screen.getAllByRole('cell');
    // Avg pace cell should contain 5:50
    expect(cells.some((c) => c.textContent === '5:50')).toBeTruthy();
    // Best pace cell should contain 4:30
    expect(cells.some((c) => c.textContent === '4:30')).toBeTruthy();
  });
});
