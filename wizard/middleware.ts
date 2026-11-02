import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/config';

// Fail closed: with no WIZARD_SESSION_SECRET configured, nobody is signed in. Route handlers
// re-verify the session and re-read the user; this is the outer door, not the only one.
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ADMIN_PATHS.has(pathname)) return NextResponse.next();
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, process.env.WIZARD_SESSION_SECRET);
  if (session) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  return NextResponse.redirect(new URL('/admin/login', request.url));
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
