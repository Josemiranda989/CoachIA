import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/internal-auth";
import { undoChangeLog } from "@/lib/coach-tools";

// POST: deshace un cambio aplicado desde el Chat Coach restaurando el snapshot.
export async function POST(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { changeLogId } = body as { changeLogId?: string };
  if (!changeLogId) {
    return NextResponse.json({ error: "changeLogId requerido" }, { status: 400 });
  }

  try {
    const summary = await undoChangeLog(changeLogId, auth.userId);
    return NextResponse.json({ undone: true, summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
}
