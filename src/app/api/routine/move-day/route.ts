import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";

const VALID_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// PATCH: move a DailyWorkout to another day of the same week. If the target day
// already has a workout, the two swap places. Content, hevyRoutineId and the
// HevyGymSlot mapping are never touched — this only reorders the calendar.
export async function PATCH(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { dailyWorkoutId, toDayOfWeek } = body as {
    dailyWorkoutId?: string;
    toDayOfWeek?: string;
  };

  if (!dailyWorkoutId || !toDayOfWeek) {
    return NextResponse.json(
      { error: "dailyWorkoutId y toDayOfWeek son requeridos" },
      { status: 400 }
    );
  }
  if (!VALID_DAYS.includes(toDayOfWeek)) {
    return NextResponse.json(
      { error: `toDayOfWeek inválido: ${toDayOfWeek}` },
      { status: 400 }
    );
  }

  const source = await prisma.dailyWorkout.findUnique({
    where: { id: dailyWorkoutId },
    include: { routine: { select: { userId: true, id: true } } },
  });
  if (!source || source.routine.userId !== auth.userId) {
    return NextResponse.json({ error: "Workout no encontrado" }, { status: 404 });
  }
  if (source.dayOfWeek === toDayOfWeek) {
    return NextResponse.json({ moved: false, reason: "mismo día" });
  }

  const target = await prisma.dailyWorkout.findFirst({
    where: { routineId: source.routine.id, dayOfWeek: toDayOfWeek },
  });

  if (target) {
    await prisma.$transaction([
      prisma.dailyWorkout.update({
        where: { id: source.id },
        data: { dayOfWeek: toDayOfWeek },
      }),
      prisma.dailyWorkout.update({
        where: { id: target.id },
        data: { dayOfWeek: source.dayOfWeek },
      }),
    ]);
    return NextResponse.json({
      moved: true,
      swappedWith: { id: target.id, type: target.type },
    });
  }

  await prisma.dailyWorkout.update({
    where: { id: source.id },
    data: { dayOfWeek: toDayOfWeek },
  });
  return NextResponse.json({ moved: true, swappedWith: null });
}
