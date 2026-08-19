import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/server/session";

const IDENTITY_URL = process.env.AIGARTH_IDENTITY_URL ?? "http://localhost:7001";

export async function POST(req: NextRequest) {
  const { email, password, name } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !password || !name) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${IDENTITY_URL}/v1/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach the identity service: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  if (!res.ok) {
    let msg = `Signup failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) msg = body.error.message;
    } catch { /* keep default */ }
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  // Auto-login after signup
  const loginRes = await fetch(`${IDENTITY_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    return NextResponse.json(
      { error: "Account created but auto-login failed. Try signing in." },
      { status: 502 },
    );
  }
  const data = (await loginRes.json()) as {
    access_token: string;
    user: { id: string; email: string; name: string };
  };
  setSession({
    accessToken: data.access_token,
    userId: data.user.id,
    email: data.user.email,
    name: data.user.name,
  });

  return NextResponse.json({ ok: true, redirect: "/dashboard" });
}
