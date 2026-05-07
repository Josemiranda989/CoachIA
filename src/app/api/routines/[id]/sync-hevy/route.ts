import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncRoutineToHevy } from "@/lib/hevy-sync";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;

  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine || routine.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const results = await syncRoutineToHevy(id);
  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const errors = results.filter((r) => r.error).length;
  const skipped = results.filter((r) => r.action === "skipped" && !r.error).length;

  return NextResponse.json({
    summary: `${created} creadas, ${updated} actualizadas, ${skipped} salteadas, ${errors} con error`,
    results,
  });
}
