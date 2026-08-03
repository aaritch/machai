import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge gate for authenticated routes.
 *
 * This checks only that a session cookie is PRESENT. It cannot validate it —
 * middleware runs on the edge runtime, with no database and no Node crypto —
 * and it deliberately does not try.
 *
 * That is fine, because this is a redirect optimisation, not access control.
 * Every dashboard page and every server action independently resolves the
 * session and re-checks ownership and entitlement (project plan C.1: frontend
 * gating is cosmetic). All this saves is rendering a shell for someone who is
 * obviously signed out.
 */

const SESSION_COOKIE = 'machai_session';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);

  if (!hasSessionCookie) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
