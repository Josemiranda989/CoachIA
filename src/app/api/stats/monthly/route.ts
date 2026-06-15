import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { getValidAccessToken, fetchActivities } from "@/lib/strava";

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
  const [completionsInMonth, workoutLogs, bodyWeights, routines] =
    await Promise.all([
      // Completions in the period (source of truth for adherence/sessions)
      prisma.workoutCompletion.findMany({
        where: {
          completed: true,
          completedAt: dateFilter,
          dailyWorkout: { routine: { userId: auth.userId } },
        },
        include: {
          dailyWorkout: { select: { id: true, type: true } },
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

      // Routines that overlap with this month (weekStart is YYYY-MM-DD string)
      (() => {
        const nextMonth = month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, "0")}-01`;
        return prisma.routine.findMany({
          where: {
            userId: auth.userId,
            weekStart: { lt: nextMonth },
          },
          include: {
            days: { include: { exercises: true } },
          },
          orderBy: { weekStart: "desc" },
          take: 8,
        });
      })(),
    ]);

  // --- Cycling stats (source of truth: Strava) ---
  let totalCyclingKm = 0;
  let totalCyclingMins = 0;
  let avgCyclingHR: number | null = null;
  let longestRideKm = 0;
  let ridesCount = 0;
  let totalCyclingKj = 0;
  let totalSuffer = 0;
  let peakHr: number | null = null;
  let avgCyclingTemp: number | null = null;

  try {
    const accessToken = await getValidAccessToken(auth.userId);
    if (accessToken) {
      const activities = await fetchActivities(accessToken, 1, 100);
      const rides = activities.filter(
        (a: any) =>
          a.type === "Ride" &&
          new Date(a.start_date) >= startDate &&
          new Date(a.start_date) < endDate
      );

      ridesCount = rides.length;
      totalCyclingKm = rides.reduce((sum: number, r: any) => sum + r.distance / 1000, 0);
      totalCyclingMins = rides.reduce((sum: number, r: any) => sum + r.moving_time / 60, 0);
      const hrs = rides.map((r: any) => r.average_heartrate).filter((hr: any): hr is number => hr != null);
      avgCyclingHR = hrs.length > 0 ? Math.round(hrs.reduce((a: number, b: number) => a + b, 0) / hrs.length) : null;
      longestRideKm = rides.reduce((max: number, r: any) => Math.max(max, r.distance / 1000), 0);
      // Additional cycling metrics
      totalCyclingKj = rides.reduce((sum: number, r: any) => sum + (r.kilojoules || 0), 0);
      totalSuffer = rides.reduce((sum: number, r: any) => sum + (r.suffer_score || 0), 0);
      peakHr = rides.reduce((max: number | null, r: any) =>
        r.max_heartrate != null && (max == null || r.max_heartrate > max) ? r.max_heartrate : max, null as number | null);
      const avgTemps = rides.map((r: any) => r.average_temp).filter((t: any): t is number => t != null);
      avgCyclingTemp = avgTemps.length > 0
        ? Math.round(avgTemps.reduce((s: number, t: number) => s + t, 0) / avgTemps.length * 10) / 10
        : null;
    }
  } catch {
    // Strava unavailable — leave stats as zeros
  }

  // --- Gym stats ---
  const gymCompletions = completionsInMonth.filter((c) =>
    c.dailyWorkout.type === "Gym" || c.dailyWorkout.type === "Gym + Cycling"
  );
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
  // Planned: routines whose Monday lands within the month (or up to 6 days before,
  // so the rest of that week falls inside the month). All weekStart values are YYYY-MM-DD.
  const minusSixDays = new Date(year, month - 1, 1);
  minusSixDays.setDate(minusSixDays.getDate() - 6);
  const monthFirstMondayMinus6 = `${minusSixDays.getFullYear()}-${String(minusSixDays.getMonth() + 1).padStart(2, "0")}-${String(minusSixDays.getDate()).padStart(2, "0")}`;
  const nextMonthFirstDay = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const routinesInMonth = routines.filter(
    (r) => r.weekStart >= monthFirstMondayMinus6 && r.weekStart < nextMonthFirstDay
  );
  const daysPlanned = routinesInMonth.reduce(
    (sum, r) => sum + r.days.filter((d) => d.type !== "Rest").length,
    0
  );
  const daysCompleted = completionsInMonth.length;

  // --- Current routine (for context in generation) ---
  const currentRoutine = routines.find((r) => r.status === "active") ?? routines[0];

  return NextResponse.json({
    period,
    cycling: {
      totalKm: Math.round(totalCyclingKm * 10) / 10,
      totalHours: Math.round((totalCyclingMins / 60) * 10) / 10,
      avgHR: avgCyclingHR,
      rides: ridesCount,
      longestRideKm: Math.round(longestRideKm * 10) / 10,
      totalKj: Math.round(totalCyclingKj * 10) / 10,
      totalKcal: Math.round(totalCyclingKj * 0.239 * 10) / 10,
      totalSufferScore: Math.round(totalSuffer * 10) / 10,
      peakHeartrate: peakHr,
      avgTemp: avgCyclingTemp,
    },
    gym: {
      sessionsCompleted: gymCompletions.length,
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
