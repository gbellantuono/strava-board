import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const redirect = NextResponse.redirect(new URL('/', req.url));
  // Clear the auth cookie by setting an immediate expiration
  redirect.cookies.set('strava_access_token', '', {
    httpOnly: true,
    // Deletion doesn't require Secure; ensure it's compatible with localhost
    secure: false,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
  return redirect;
}
