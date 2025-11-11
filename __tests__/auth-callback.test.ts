/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

describe('auth callback club gating', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    (global.fetch as any).mockReset?.();
  });

  it('allows login when athlete is member of club', async () => {
    process.env.STRAVA_CLUB_ID = '12345';
    process.env.STRAVA_CLIENT_ID = 'cid';
    process.env.STRAVA_CLIENT_SECRET = 'secret';
    process.env.STRAVA_REDIRECT_URI = 'http://localhost/callback';

    const tokenPayload = {
      access_token: 'token123',
      athlete: { id: 999, firstname: 'Jane', lastname: 'Doe' },
    };

    let fetchCall = 0;
    global.fetch = jest.fn((url: string) => {
      fetchCall++;
      if (url.includes('/oauth/token')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => tokenPayload,
          text: async () => JSON.stringify(tokenPayload),
        } as any);
      }
      if (url.includes('/athlete/clubs')) {
        const body = JSON.stringify([{ id: 12345 }]);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => JSON.parse(body),
          text: async () => body,
        } as any);
      }
      throw new Error('Unexpected fetch url ' + url);
    }) as any;

    jest.resetModules();
    const { GET: authCallback } = await import(
      '../app/api/auth/strava/callback/route'
    );
    const req = new NextRequest(
      'http://localhost/api/auth/strava/callback?code=abc'
    );
    const res = await authCallback(req);
    expect(res.headers.get('location')).toBe('http://localhost/');
    // Cookie should be set
    expect(res.cookies.get('strava_access_token')?.value).toBe('token123');
    expect(fetchCall).toBe(2);
  });

  it('denies login when athlete not in club', async () => {
    process.env.STRAVA_CLUB_ID = '99999';
    process.env.STRAVA_CLIENT_ID = 'cid';
    process.env.STRAVA_CLIENT_SECRET = 'secret';
    process.env.STRAVA_REDIRECT_URI = 'http://localhost/callback';

    const tokenPayload = {
      access_token: 'token456',
      athlete: { id: 111 },
    };

    global.fetch = jest.fn((url: string) => {
      if (url.includes('/oauth/token')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => tokenPayload,
          text: async () => JSON.stringify(tokenPayload),
        } as any);
      }
      if (url.includes('/athlete/clubs')) {
        const body = JSON.stringify([{ id: 12345 }]);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => JSON.parse(body),
          text: async () => body,
        } as any);
      }
      throw new Error('Unexpected fetch url ' + url);
    }) as any;

    jest.resetModules();
    const { GET: authCallback } = await import(
      '../app/api/auth/strava/callback/route'
    );
    const req = new NextRequest(
      'http://localhost/api/auth/strava/callback?code=abc'
    );
    const res = await authCallback(req);
    expect(res.headers.get('location')).toBe(
      'http://localhost/?error=not_in_club'
    );
    expect(res.cookies.get('strava_access_token')).toBeUndefined();
  });

  it('fails with invalid club id', async () => {
    process.env.STRAVA_CLUB_ID = 'abc';
    process.env.STRAVA_CLIENT_ID = 'cid';
    process.env.STRAVA_CLIENT_SECRET = 'secret';
    process.env.STRAVA_REDIRECT_URI = 'http://localhost/callback';

    const tokenPayload = {
      access_token: 'token789',
      athlete: { id: 222 },
    };

    global.fetch = jest.fn((url: string) => {
      if (url.includes('/oauth/token')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => tokenPayload,
          text: async () => JSON.stringify(tokenPayload),
        } as any);
      }
      throw new Error('Unexpected fetch url ' + url);
    }) as any;

    jest.resetModules();
    const { GET: authCallback } = await import(
      '../app/api/auth/strava/callback/route'
    );
    const req = new NextRequest(
      'http://localhost/api/auth/strava/callback?code=abc'
    );
    const res = await authCallback(req);
    expect(res.headers.get('location')).toBe(
      'http://localhost/?error=invalid_club_id'
    );
    expect(res.cookies.get('strava_access_token')).toBeUndefined();
  });
});
