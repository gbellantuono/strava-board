import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL('/', req.url);
  const isHttps = url.protocol === 'https:';
  const redirect = NextResponse.redirect(url);
  // Clear the auth cookie by setting an immediate expiration
  redirect.cookies.set('strava_access_token', '', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
  return redirect;
}
