/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import LeaderboardTable, { AthleteStats } from '../components/LeaderboardTable';

describe('LeaderboardTable avatar fallback', () => {
  it('renders gray placeholder when profile is null', () => {
    const rows: AthleteStats[] = [
      {
        athlete_id: 1,
        athlete_name: 'No Avatar',
        position: 4,
        medal: null,
        profile: null,
        total_runs: 3,
        total_distance_km: 15.2,
        max_distance_km: 6.7,
        total_run_time_hms: '01:30:00',
        average_run_time_mins: 30,
        average_pace_min_per_km: 5.5,
        best_pace_min_per_km: 5.1,
        last_run: '2025-11-10T00:00:00.000Z',
      },
    ];

    render(<LeaderboardTable data={rows} />);
    // The avatar span uses aria-label set to athlete name
    const avatarContainer = screen.getByLabelText('No Avatar');
    // Ensure no <img> inside (fallback only)
    const img = avatarContainer.querySelector('img');
    expect(img).toBeNull(); // no image
    expect(avatarContainer.textContent?.trim().charAt(0)).toBe('N'); // initial letter fallback
  });
});
