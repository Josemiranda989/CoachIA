import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const race = await prisma.race.findUnique({ where: { id } });
  if (!race || race.userId !== auth.userId) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  await prisma.race.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
