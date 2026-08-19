import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth middleware for the customer dashboard.
 *
 * - Unauthenticated requests to /dashboard/* are redirected to /login.
 * - Authenticated requests to /login or /signup are redirected to /dashboard.
 *
 * The cookie name and shape match the identity service's own
 * `aigarth_session` cookie so a single sign-on works in production.
 */

const SESSION_COOKIE = "aigarth_session";
const PROTECTED = ["/dashboard"];
const AUTH = ["/login", "/signup"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookie = req.cookies.get(SESSION_COOKIE);
  const isAuthed = Boolean(cookie?.value);

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!isAuthed) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  if (AUTH.includes(pathname) && isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
