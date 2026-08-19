/**
 * Server-side session helpers.
 *
 * The cookie holds the JWT issued by the identity service at
 * /v1/auth/login or /v1/auth/signup. We use the same name and shape
 * the identity service sets (`aigarth_session`) so that if both
 * apps/web and services/identity share a domain in production, the
 * cookie Just Works.
 *
 * HttpOnly + SameSite=Lax + Secure-in-prod is the default. JWTs
 * come from a third-party (the identity service), so we don't try
 * to verify them here: we forward them as Bearer on every
 * downstream call via the SDK.
 */

import { cookies } from "next/headers";

const COOKIE_NAME = "aigarth_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionCookie {
  accessToken: string;
  userId?: string;
  email?: string;
  name?: string;
}

export function getSession(): SessionCookie | null {
  const c = cookies().get(COOKIE_NAME);
  if (!c?.value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(c.value));
    if (typeof parsed?.accessToken !== "string") return null;
    return parsed as SessionCookie;
  } catch {
    return null;
  }
}

export function setSession(value: SessionCookie): void {
  cookies().set(COOKIE_NAME, JSON.stringify(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSession(): void {
  cookies().delete(COOKIE_NAME);
}
