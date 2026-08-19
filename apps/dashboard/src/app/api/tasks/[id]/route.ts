import { NextResponse } from "next/server";
import { updateTask, getTask } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const existing = getTask(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  const updated = updateTask(params.id, body);
  return NextResponse.json(updated);
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const task = getTask(params.id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(task);
}
