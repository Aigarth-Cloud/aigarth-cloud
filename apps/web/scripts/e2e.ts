/**
 * Phase 9 E2E: apps/web integration smoke test.
 *
 * Exercises the auth flow + dashboard pages against the running
 * apps/web (port 3003) and the 7 backing services.
 *
 *   pnpm dev (apps/web)       # in one terminal
 *   pnpm tsx scripts/e2e.ts   # in another
 */

import { Aigarth } from "@aigarth/sdk";

const WEB = process.env["AIGARTH_WEB_URL"] ?? "http://localhost:3003";
const services = {
  identity: process.env["AIGARTH_IDENTITY_URL"] ?? "http://localhost:7001",
  qubic: process.env["AIGARTH_QUBIC_URL"] ?? "http://localhost:7002",
  compute: process.env["AIGARTH_COMPUTE_URL"] ?? "http://localhost:7003",
  gateway: process.env["AIGARTH_GATEWAY_URL"] ?? "http://localhost:7004",
  billing: process.env["AIGARTH_BILLING_URL"] ?? "http://localhost:7005",
  ann: process.env["AIGARTH_ANN_URL"] ?? "http://localhost:7006",
  marketplace: process.env["AIGARTH_MARKETPLACE_URL"] ?? "http://localhost:7007",
};

let assertions = 0;
function ts() { return new Date().toISOString().slice(11, 23); }
function log(m: string) { console.log(`[${ts()}] ${m}`); }
function ok(m: string) { log(`  ✓ ${m}`); }
function fail(m: string): never { log(`  ✗ ${m}`); process.exit(1); }
function assert(cond: unknown, m: string) {
  assertions++;
  if (!cond) fail(m);
}

// Persistent cookie jar
let cookie: string | null = null;

function setCookie(res: Response) {
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0]!;
}

async function jfetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${WEB}${path}`, { ...init, headers, redirect: "manual" });
  setCookie(res);
  return res;
}

async function main() {
  log("=== Phase 9: apps/web E2E ===");
  log("");

  // -------------------------------------------------------------------------
  // 1. Marketing site reachable
  // -------------------------------------------------------------------------
  log("1. Marketing site reachable");
  const home = await fetch(`${WEB}/`);
  assert(home.status === 200, `home: ${home.status}`);
  const pricing = await fetch(`${WEB}/pricing`);
  assert(pricing.status === 200, `pricing: ${pricing.status}`);
  ok(`Home + pricing both 200`);

  // -------------------------------------------------------------------------
  // 2. Login + signup pages
  // -------------------------------------------------------------------------
  log("");
  log("2. Auth pages render");
  const loginPage = await fetch(`${WEB}/login`);
  assert(loginPage.status === 200, `login page: ${loginPage.status}`);
  // Pages are client components; just verify the route is registered
  // and the JS chunk is loaded.
  const loginHtml = await loginPage.text();
  assert(loginHtml.includes("app/(auth)/login/page"), "login page chunk referenced");
  const signupPage = await fetch(`${WEB}/signup`);
  assert(signupPage.status === 200, `signup page: ${signupPage.status}`);
  const signupHtml = await signupPage.text();
  assert(signupHtml.includes("app/(auth)/signup/page"), "signup page chunk referenced");
  ok("Login + signup pages render with JS chunks");

  // -------------------------------------------------------------------------
  // 3. Middleware redirects unauthenticated /dashboard
  // -------------------------------------------------------------------------
  log("");
  log("3. Middleware guards /dashboard");
  const guarded = await fetch(`${WEB}/dashboard`, { redirect: "manual" });
  assert(guarded.status === 307 || guarded.status === 302, `dashboard should redirect, got ${guarded.status}`);
  assert(
    guarded.headers.get("location")?.startsWith("/login") ?? false,
    `dashboard redirect to /login, got ${guarded.headers.get("location")}`,
  );
  ok(`/dashboard → ${guarded.headers.get("location")}`);

  // -------------------------------------------------------------------------
  // 4. Signup flow
  // -------------------------------------------------------------------------
  log("");
  log("4. Signup + auto-login");
  const email = `p9-${Date.now()}@example.com`;
  const signup = await jfetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password: "Test-Password-1234!", name: "Phase 9" }),
  });
  assert(signup.status === 200, `signup: ${signup.status}`);
  const signupBody = (await signup.json()) as { ok: boolean; redirect: string };
  assert(signupBody.ok === true, "signup ok");
  assert(cookie?.includes("aigarth_session") ?? false, "session cookie set");
  ok(`Signed up: ${email}, cookie set`);

  // -------------------------------------------------------------------------
  // 5. Dashboard pages render with real data
  // -------------------------------------------------------------------------
  log("");
  log("5. Dashboard pages render with real data");
  const pages = [
    { path: "/dashboard", expect: ["Welcome back", "Phase 9"] },
    { path: "/dashboard/api-keys", expect: ["API keys", "Generate key"] },
    { path: "/dashboard/usage", expect: ["Usage", "Total requests"] },
    { path: "/dashboard/models", expect: ["Models", "available"] },
    { path: "/dashboard/billing", expect: ["Billing", "Plans"] },
    { path: "/dashboard/compute", expect: ["Compute", "Regions"] },
    { path: "/dashboard/clusters", expect: ["Clusters"] },
    { path: "/dashboard/marketplace", expect: ["Marketplace", "listings"] },
    { path: "/dashboard/capacity", expect: ["Capacity", "Compute credit"] },
    { path: "/dashboard/playground", expect: ["Playground"] },
  ];
  for (const p of pages) {
    const res = await jfetch(p.path);
    assert(res.status === 200, `${p.path}: ${res.status}`);
    const html = await res.text();
    for (const needle of p.expect) {
      assert(html.includes(needle), `${p.path} contains "${needle}"`);
    }
    ok(`${p.path}`);
  }

  // -------------------------------------------------------------------------
  // 6. Create + revoke an API key
  // -------------------------------------------------------------------------
  log("");
  log("6. Create + revoke a key via /api/keys");
  const create = await jfetch("/api/keys", {
    method: "POST",
    body: JSON.stringify({ name: "e2e-key", scopes: ["chat:read", "chat:write"] }),
  });
  assert(create.status === 200, `key create: ${create.status}`);
  const createBody = (await create.json()) as {
    ok: boolean;
    full_key?: string;
    id?: string;
    prefix?: string;
    secret_last4?: string;
  };
  assert(createBody.ok === true, "create ok");
  assert(createBody.full_key?.startsWith("ak_live_") ?? false, "full_key format");
  ok(`Key created: ${createBody.prefix}…${createBody.secret_last4}`);

  // Revoke
  const revoke = await jfetch(`/api/keys/${encodeURIComponent(createBody.id!)}`, {
    method: "DELETE",
  });
  assert(revoke.status === 200, `key revoke: ${revoke.status}`);
  ok(`Key revoked: ${createBody.id}`);

  // -------------------------------------------------------------------------
  // 7. Topbar shows real user from /v1/me
  // -------------------------------------------------------------------------
  log("");
  log("7. Topbar shows real /v1/me user");
  const dashHtml = await (await jfetch("/dashboard")).text();
  assert(dashHtml.includes("Phase 9"), "topbar shows 'Phase 9' name");
  assert(!dashHtml.includes("Sign in"), "topbar does NOT show 'Sign in' link when authed");
  ok("Real user rendered in topbar");

  // -------------------------------------------------------------------------
  // 8. Sign out clears cookie
  // -------------------------------------------------------------------------
  log("");
  log("8. Sign out clears cookie");
  const logout = await jfetch("/api/auth/logout", { method: "POST" });
  assert(logout.status === 200, `logout: ${logout.status}`);
  const dash2 = await jfetch("/dashboard");
  // Should now redirect to login (or return 307/302)
  assert(dash2.status === 307 || dash2.status === 302, `post-logout dashboard: ${dash2.status}`);
  ok(`Post-logout: ${dash2.headers.get("location")}`);

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------
  log("");
  log("=== ALL APPS/WEB E2E TESTS PASSED ===");
  log(`Summary: 8 sections, ${assertions} assertions, all green.`);
}

main().catch((err) => {
  console.error("E2E failed:", err);
  process.exit(1);
});
