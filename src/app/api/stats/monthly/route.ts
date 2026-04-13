import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";

export async function GET(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // "2026-04"

  // Default: previous month
  const now = new Date();
  let year: number, month: number;

  if (monthParam) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m;
  } else {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    year = prev.getFullYear();
    month = prev.getMonth() + 1;
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const period = `${year}-${String(month).padStart(2, "0")}`;

  const dateFilter = { gte: startDate, lt: endDate };

  // Parallel queries
  const [cyclingWorkouts, gymWorkouts, workoutLogs, bodyWeights, routines] =
    await Promise.all([
      // Cycling workouts in the period
      prisma.dailyWorkout.findMany({
        where: {
          type: { contains: "Cycling" },
          date: dateFilter,
          routine: { userId: auth.userId },
        },
      }),

      // Gym workouts in the period
      prisma.dailyWorkout.findMany({
        where: {
          type: { in: ["Gym", "Gym + Cycling"] },
          date: dateFilter,
          routine: { userId: auth.userId },
        },
        include: {
          exercises: {
            include: { logs: true },
          },
        },
      }),

      // All workout logs in the period (for volume calculation)
      prisma.workoutLog.findMany({
        where: {
          exercise: {
            dailyWorkout: {
              date: dateFilter,
              routine: { userId: auth.userId },
            },
          },
        },
        include: {
          exercise: true,
        },
      }),

      // Body weight records
      prisma.bodyWeight.findMany({
        where: {
          userId: auth.userId,
          date: dateFilter,
        },
        orderBy: { date: "asc" },
      }),

      // Routines that overlap with this month
      prisma.routine.findMany({
        where: {
          userId: auth.userId,
          weekStart: { lte: endDate },
        },
        include: {
          days: { include: { exercises: true } },
        },
        orderBy: { weekStart: "desc" },
        take: 5,
      }),
    ]);

  // --- Cycling stats ---
  const completedCycling = cyclingWorkouts.filter((w) => w.completed);
  const totalCyclingKm = completedCycling.reduce(
    (sum, w) => sum + (w.distance ?? 0),
    0
  );
  const totalCyclingMins = completedCycling.reduce(
    (sum, w) => sum + (w.actualDuration ?? 0),
    0
  );
  const cyclingHRs = completedCycling
    .map((w) => w.averageHeartRate)
    .filter((hr): hr is number => hr !== null);
  const avgCyclingHR =
    cyclingHRs.length > 0
      ? Math.round(cyclingHRs.reduce((a, b) => a + b, 0) / cyclingHRs.length)
      : null;
  const longestRideKm = completedCycling.reduce(
    (max, w) => Math.max(max, w.distance ?? 0),
    0
  );

  // --- Gym stats ---
  const completedGym = gymWorkouts.filter((w) => w.completed);
  const totalVolume = workoutLogs.reduce(
    (sum, log) => sum + log.reps * log.weight,
    0
  );

  // Exercise progression: group by exercise name, find max weight per exercise
  const exerciseMaxes: Record<string, { maxWeight: number; bestReps: number }> =
    {};
  for (const log of workoutLogs) {
    const name = log.exercise.name;
    if (
      !exerciseMaxes[name] ||
      log.weight > exerciseMaxes[name].maxWeight ||
      (log.weight === exerciseMaxes[name].maxWeight &&
        log.reps > exerciseMaxes[name].bestReps)
    ) {
      exerciseMaxes[name] = { maxWeight: log.weight, bestReps: log.reps };
    }
  }

  // --- Body stats ---
  const weightStart = bodyWeights.length > 0 ? bodyWeights[0].weight : null;
  const weightEnd =
    bodyWeights.length > 0 ? bodyWeights[bodyWeights.length - 1].weight : null;
  const weightDelta =
    weightStart !== null && weightEnd !== null ? weightEnd - weightStart : null;
  const bodyFats = bodyWeights
    .map((bw) => bw.bodyFat)
    .filter((bf): bf is number => bf !== null);
  const avgBodyFat =
    bodyFats.length > 0
      ? Math.round(
          (bodyFats.reduce((a, b) => a + b, 0) / bodyFats.length) * 10
        ) / 10
      : null;

  // --- Adherence ---
  const allWorkoutsInPeriod = [...cyclingWorkouts, ...gymWorkouts];
  // Deduplicate by id (Gym + Cycling days appear in both lists)
  const uniqueWorkouts = new Map(allWorkoutsInPeriod.map((w) => [w.id, w]));
  const daysPlanned = uniqueWorkouts.size;
  const daysCompleted = [...uniqueWorkouts.values()].filter(
    (w) => w.completed
  ).length;

  // --- Current routine (for context in generation) ---
  const currentRoutine = routines.find((r) => r.status === "active") ?? routines[0];

  return NextResponse.json({
    period,
    cycling: {
      totalKm: Math.round(totalCyclingKm * 10) / 10,
      totalHours: Math.round((totalCyclingMins / 60) * 10) / 10,
      avgHR: avgCyclingHR,
      rides: completedCycling.length,
      longestRideKm: Math.round(longestRideKm * 10) / 10,
    },
    gym: {
      sessionsCompleted: completedGym.length,
      totalVolume: Math.round(totalVolume),
      exerciseProgression: exerciseMaxes,
    },
    body: {
      weightStart,
      weightEnd,
      weightDelta:
        weightDelta !== null ? Math.round(weightDelta * 10) / 10 : null,
      avgBodyFat,
      measurements: bodyWeights.length,
    },
    adherence: {
      daysPlanned,
      daysCompleted,
      percentage:
        daysPlanned > 0 ? Math.round((daysCompleted / daysPlanned) * 100) : 0,
    },
    currentRoutine: currentRoutine
      ? {
          weekStart: currentRoutine.weekStart,
          status: currentRoutine.status,
          days: currentRoutine.days.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            type: d.type,
            exerciseCount: d.exercises.length,
            targetDuration: d.targetDuration,
          })),
        }
      : null,
  });
}
