import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { revalidatePath } from "next/cache";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body; // "approve" | "reject"

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 }
    );
  }

  // Verify the routine exists and belongs to the user
  const routine = await prisma.routine.findFirst({
    where: { id, userId: auth.userId },
  });

  if (!routine) {
    return NextResponse.json({ error: "Routine not found" }, { status: 404 });
  }

  if (routine.status !== "pending_approval") {
    return NextResponse.json(
      { error: "Routine is not pending approval" },
      { status: 400 }
    );
  }

  if (action === "approve") {
    // Archive all currently active routines
    await prisma.routine.updateMany({
      where: { userId: auth.userId, status: "active" },
      data: { status: "archived" },
    });

    // Activate the new routine
    await prisma.routine.update({
      where: { id },
      data: { status: "active" },
    });

    revalidatePath("/workout/today");
    revalidatePath("/routine/week");
    revalidatePath("/routine/pending");

    return NextResponse.json({
      message: "Rutina aprobada y activada",
      status: "active",
    });
  }

  // Reject: delete the routine and its related data
  await prisma.routine.delete({ where: { id } });

  revalidatePath("/routine/pending");

  return NextResponse.json({
    message: "Rutina rechazada y eliminada",
    status: "deleted",
  });
}
