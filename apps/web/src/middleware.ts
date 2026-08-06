import { NextResponse, type NextRequest } from 'next/server';
// Imported from the dedicated entrypoint, not the package root: the root pulls
// in the server config, which must never reach the edge runtime.
import { AFFILIATE_PROGRAM, REFERRAL_COOKIE } from '@machai/config/affiliate';

/**
 * Edge middleware: referral attribution and the authenticated-route gate.
 *
 * The auth half checks only that a session cookie is PRESENT. It cannot
 * validate it — middleware runs on the edge runtime, with no database and no
 * Node crypto — and deliberately does not try. Every dashboard page and server
 * action independently resolves the session and re-checks ownership and
 * entitlement (project plan C.1: frontend gating is cosmetic). This only saves
 * rendering a shell for someone obviously signed out.
 */

const SESSION_COOKIE = 'machai_session';
const REFERRAL_PARAM = 'ref';

/** Matches the alphabet in @machai/config; edge-safe, no import of node crypto. */
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

export function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');
  if (isProtected && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next();

  /**
   * Capture `?ref=CODE` into a first-party cookie.
   *
   * Stored rather than carried through the URL because the visitor will browse
   * several pages before signing up, and the code has to survive that. Read
   * server-side at signup and validated against the database there — the cookie
   * is a hint, never an authority.
   *
   * First code wins: overwriting on a later visit would let one affiliate
   * appropriate another's referral by getting their link in front of the same
   * person second.
   */
  const raw = searchParams.get(REFERRAL_PARAM);
  if (raw && !request.cookies.has(REFERRAL_COOKIE)) {
    const code = raw.trim().toUpperCase();
    if (CODE_PATTERN.test(code)) {
      response.cookies.set(REFERRAL_COOKIE, code, {
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: AFFILIATE_PROGRAM.attributionWindowDays * 24 * 3600,
      });
    }
  }

  return response;
}

export const config = {
  /**
   * Everything except static assets and API routes.
   *
   * Broader than the auth gate needs, because a referral link can point at any
   * marketing page — `/pricing?ref=CODE` is a likelier share than the homepage.
   * Excluding `/api` matters: the Stripe webhook must not be touched by
   * middleware, since anything that reads the request risks the raw body.
   */
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|brand/).*)'],
};
