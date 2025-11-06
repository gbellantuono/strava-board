import { NextRequest, NextResponse } from 'next/server';

const CLIENT_ID = process.env.STRAVA_CLIENT_ID!;
const REDIRECT_URI = process.env.STRAVA_REDIRECT_URI!;

export async function GET(_req: NextRequest) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'read,activity:read_all',
  });
  const url = `https://www.strava.com/oauth/authorize?${params.toString()}`;
  return NextResponse.redirect(url);
}
