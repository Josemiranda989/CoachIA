import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { getCurrentWeekStart } from "@/lib/week";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export async function GET(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const today = DAY_NAMES[new Date().getDay()];
  const weekStart = getCurrentWeekStart();

  // First, try to find a routine for the current week or past weeks
  let routine = await prisma.routine.findFirst({
    where: {
      userId: auth.userId,
      status: "active",
      weekStart: { lte: weekStart },
    },
    orderBy: { weekStart: "desc" },
    include: {
      days: {
        where: { dayOfWeek: today },
        include: {
          exercises: true,
          completions: { where: { weekStart } },
        },
      },
    },
  });

  // If no routine for current/past weeks, look for upcoming ones
  if (!routine) {
    routine = await prisma.routine.findFirst({
      where: {
        userId: auth.userId,
        status: "active",
        weekStart: { gt: weekStart },
      },
      orderBy: { weekStart: "asc" },
      include: {
        days: {
          where: { dayOfWeek: today },
          include: {
            exercises: true,
            completions: { where: { weekStart } },
          },
        },
      },
    });
  }

  if (!routine || routine.days.length === 0) {
    return NextResponse.json({
      dayOfWeek: today,
      type: "Rest",
      exercises: [],
      message: "No hay rutina activa o es dia de descanso",
    });
  }

  const day = routine.days[0];
  const completion = day.completions[0];

  return NextResponse.json({
    dayOfWeek: today,
    type: day.type,
    exercises: day.exercises.map((e) => ({
      name: e.name,
      sets: e.targetSets,
      reps: e.targetReps,
    })),
    targetDuration: day.targetDuration,
    targetPower: day.targetPower,
    notes: day.notes,
    completed: completion?.completed ?? false,
  });
}
