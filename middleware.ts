import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, safeEqual, verifySessionToken } from '@/lib/admin-auth';

// Reachable without a session so the login page can sign in
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/api/admin/auth'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ADMIN_PATHS.includes(pathname)) return NextResponse.next();

  // Fail closed: with no admin secret configured, nobody is authorized
  const secret = process.env.ADMIN_SECRET_KEY;
  let authorized = false;
  if (secret) {
    const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    authorized = bearer
      ? safeEqual(bearer, secret)
      : await verifySessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, secret);
  }
  if (authorized) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/admin/login', request.url));
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
