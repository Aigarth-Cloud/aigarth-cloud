import { NextResponse } from "next/server";
import { clearSession } from "@/lib/server/session";

export async function POST() {
  clearSession();
  return NextResponse.json({ ok: true, redirect: "/" });
}
