import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { getCurrentWeekStart } from "@/lib/week";
import { revalidatePath } from "next/cache";
import { syncRoutineToHevy, type SyncResult } from "@/lib/hevy-sync";

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
    const toArchive = await prisma.routine.findMany({
      where: {
        userId: auth.userId,
        status: "active",
        weekStart: { lt: currentWeekMonday },
      },
      select: { id: true },
    });
    await prisma.routine.updateMany({
      where: { id: { in: toArchive.map((r) => r.id) } },
      data: { status: "archived" },
    });
    // No Hevy archiving: the 3 gym routines are persistent slots reused across
    // mesocycles (HevyGymSlot). Renaming them to "OLD" would archive the LIVE ones.

    await prisma.routine.updateMany({
      where: { userId: auth.userId, status: "pending_approval" },
      data: { status: "active" },
    });

    // Sequential, NOT parallel: week 1 POSTs the 3 gym slots and persists them;
    // weeks 2-4 then reuse those slots via PUT. Promise.all would race — all 4
    // weeks would read "no slot yet" and POST, creating duplicate Hevy routines.
    const syncResultsPerRoutine: SyncResult[][] = [];
    for (const p of pending) {
      const r = await syncRoutineToHevy(p.id).catch((e: unknown) => [
        {
          dayOfWeek: "?",
          action: "skipped" as const,
          error: e instanceof Error ? e.message : String(e),
        },
      ]);
      syncResultsPerRoutine.push(r);
    }
    const flatSync = syncResultsPerRoutine.flat();
    const hevyCreated = flatSync.filter((r) => r.action === "created").length;
    const hevyUpdated = flatSync.filter((r) => r.action === "updated").length;
    const hevyErrors = flatSync.filter((r) => r.error).length;

    revalidatePath("/workout/today");
    revalidatePath("/routine/week");
    revalidatePath("/routine/pending");

    const hevyNote =
      hevyCreated + hevyUpdated + hevyErrors > 0
        ? ` · Hevy: ${hevyCreated} creadas, ${hevyUpdated} actualizadas${
            hevyErrors ? `, ${hevyErrors} errores` : ""
          }`
        : "";

    return NextResponse.json({
      message: `Mesociclo aprobado: ${pending.length} rutina(s) activada(s)${hevyNote}`,
      activatedCount: pending.length,
      weekStarts: pending.map((p) => p.weekStart),
      hevySync: flatSync,
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
