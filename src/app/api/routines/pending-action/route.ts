import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { getCurrentWeekStart } from "@/lib/week";
import { revalidatePath } from "next/cache";

// POST /api/routines/pending-action
// Batch approve or reject ALL pending_approval routines for the current user.
// Approve: activate every pending_approval (and archive previously-active) —
// matches the mesocycle mental model where generate-monthly creates 4 routines as a unit.
// Reject: delete all pending_approval routines for this user.
export async function POST(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 }
    );
  }

  const pending = await prisma.routine.findMany({
    where: { userId: auth.userId, status: "pending_approval" },
    select: { id: true, weekStart: true },
    orderBy: { weekStart: "asc" },
  });

  if (pending.length === 0) {
    return NextResponse.json(
      { error: "No pending routines to process" },
      { status: 404 }
    );
  }

  if (action === "approve") {
    // Only archive routines whose week has strictly passed (before this current week's
    // Monday). The in-progress week survives until it naturally ends, closing the gap
    // between approval day and the first new week of the mesocycle.
    const currentWeekMonday = getCurrentWeekStart();
    await prisma.routine.updateMany({
      where: {
        userId: auth.userId,
        status: "active",
        weekStart: { lt: currentWeekMonday },
      },
      data: { status: "archived" },
    });

    await prisma.routine.updateMany({
      where: { userId: auth.userId, status: "pending_approval" },
      data: { status: "active" },
    });

    revalidatePath("/workout/today");
    revalidatePath("/routine/week");
    revalidatePath("/routine/pending");

    return NextResponse.json({
      message: `Mesociclo aprobado: ${pending.length} rutina(s) activada(s)`,
      activatedCount: pending.length,
      weekStarts: pending.map((p) => p.weekStart),
    });
  }

  await prisma.routine.deleteMany({
    where: { userId: auth.userId, status: "pending_approval" },
  });

  revalidatePath("/routine/pending");

  return NextResponse.json({
    message: `Mesociclo rechazado: ${pending.length} rutina(s) eliminada(s)`,
    deletedCount: pending.length,
  });
}
