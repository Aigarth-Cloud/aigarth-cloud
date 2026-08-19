import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/server/session";

const IDENTITY_URL = process.env.AIGARTH_IDENTITY_URL ?? "http://localhost:7001";

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${IDENTITY_URL}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach the identity service: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  if (!res.ok) {
    let msg = `Login failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) msg = body.error.message;
    } catch { /* keep default */ }
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  const data = (await res.json()) as {
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
