import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getStravaActivities, getStravaContext } from "@/lib/strava-cached";

const PHASE_MAP_4WEEKS: Record<number, string> = {
  1: "BUILD base",
  2: "BUILD",
  3: "PEAK",
  4: "RECOVERY",
};

export const getWeightDelta = cache(async (userId: string) => {
  const latest = await prisma.bodyWeight.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
    select: { weight: true, date: true },
  });
  if (!latest) return null;

  // Closest weigh-in from at least ~7 days before the latest one.
  const sixDaysBefore = new Date(latest.date);
  sixDaysBefore.setDate(sixDaysBefore.getDate() - 6);
  const previous = await prisma.bodyWeight.findFirst({
    where: { userId, date: { lte: sixDaysBefore } },
    orderBy: { date: "desc" },
    select: { weight: true },
  });

  return {
    current: latest.weight,
    delta: previous ? latest.weight - previous.weight : null,
  };
});

export const getGymWeek = cache(async (userId: string, weekStart: string) => {
  const [completions, logs] = await Promise.all([
    prisma.workoutCompletion.findMany({
      where: {
        weekStart,
        completed: true,
        dailyWorkout: {
          type: { contains: "Gym" },
          routine: { userId },
        },
      },
      select: { id: true },
    }),
    prisma.workoutLog.findMany({
      where: {
        weekStart,
        exercise: { dailyWorkout: { routine: { userId } } },
      },
      select: { reps: true, weight: true },
    }),
  ]);

  const volume = logs.reduce((sum, l) => sum + l.reps * l.weight, 0);
  return { sessions: completions.length, volume };
});

export const getCyclingWeek = cache(async (userId: string, weekStart: string) => {
  const ctx = await getStravaContext(userId);
  if (!ctx) return null;

  // weekStart is YYYY-MM-DD of Monday in ART. Treat 00:00 ART as the lower bound.
  const weekStartDate = new Date(`${weekStart}T00:00:00-03:00`);
  const activities = await getStravaActivities(userId, 1, 30);

  const rides = (activities as Array<{
    type: string;
    start_date: string;
    distance?: number;
    moving_time?: number;
  }>).filter(
    (a) =>
      (a.type === "Ride" || a.type === "VirtualRide") &&
      new Date(a.start_date) >= weekStartDate,
  );

  const distance = rides.reduce((s, a) => s + (a.distance || 0), 0) / 1000;
  const durationSec = rides.reduce((s, a) => s + (a.moving_time || 0), 0);
  return { count: rides.length, distance, durationSec };
});

export const getMesocycle = cache(async (userId: string, weekStart: string) => {
  const current = await prisma.routine.findFirst({
    where: { userId, weekStart: { lte: weekStart } },
    orderBy: { weekStart: "desc" },
    select: { id: true, createdAt: true },
  });
  if (!current) return null;

  // Same generate-monthly transaction creates 4 routines with near-identical createdAt.
  // ±1h window covers any clock skew without bleeding into manually loaded JSONs.
  const oneHourMs = 60 * 60 * 1000;
  const lo = new Date(current.createdAt.getTime() - oneHourMs);
  const hi = new Date(current.createdAt.getTime() + oneHourMs);

  const cohort = await prisma.routine.findMany({
    where: { userId, createdAt: { gte: lo, lte: hi } },
    orderBy: { weekStart: "asc" },
    select: { id: true },
  });

  const index = cohort.findIndex((r) => r.id === current.id);
  if (index === -1) return null;

  const week = index + 1;
  const total = cohort.length;
  const phase = total === 4 ? PHASE_MAP_4WEEKS[week] ?? null : null;
  return { week, total, phase };
});

export type MesocycleWeekProgress = {
  week: number;
  weekStart: string;
  phase: string | null;
  planned: number;
  completed: number;
  adherencePct: number;
  cyclingKm: number;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
};

export const getMesocycleProgress = cache(
  async (userId: string, weekStart: string) => {
    const current = await prisma.routine.findFirst({
      where: { userId, weekStart: { lte: weekStart }, status: "active" },
      orderBy: { weekStart: "desc" },
      select: { id: true, createdAt: true },
    });
    if (!current) return null;

    const oneHourMs = 60 * 60 * 1000;
    const lo = new Date(current.createdAt.getTime() - oneHourMs);
    const hi = new Date(current.createdAt.getTime() + oneHourMs);

    const cohort = await prisma.routine.findMany({
      where: { userId, createdAt: { gte: lo, lte: hi } },
      orderBy: { weekStart: "asc" },
      include: {
        days: {
          select: {
            type: true,
            completions: { select: { weekStart: true, completed: true } },
          },
        },
      },
    });
    if (cohort.length === 0) return null;

    // Fetch enough Strava activities to cover a 4-week mesocycle. Default per_page is 30;
    // 50 is plenty for any realistic ride cadence. Suspense-friendly via React.cache.
    const ctx = await getStravaContext(userId);
    const activities = ctx ? await getStravaActivities(userId, 1, 50) : [];

    const total = cohort.length;
    const weeks: MesocycleWeekProgress[] = cohort.map((r, idx) => {
      const week = idx + 1;
      const phase = total === 4 ? PHASE_MAP_4WEEKS[week] ?? null : null;

      const trainingDays = r.days.filter((d) => !d.type.includes("Rest"));
      const completedDays = trainingDays.filter((d) =>
        d.completions.some((c) => c.weekStart === r.weekStart && c.completed),
      );
      const planned = trainingDays.length;
      const completed = completedDays.length;
      const adherencePct = planned > 0 ? Math.round((completed / planned) * 100) : 0;

      const weekStartDate = new Date(`${r.weekStart}T00:00:00-03:00`);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 7);
      const weekRides = (activities as Array<{
        type: string;
        start_date: string;
        distance?: number;
      }>).filter((a) => {
        if (a.type !== "Ride" && a.type !== "VirtualRide") return false;
        const d = new Date(a.start_date);
        return d >= weekStartDate && d < weekEndDate;
      });
      const cyclingKm = Math.round(
        weekRides.reduce((s, a) => s + (a.distance || 0), 0) / 1000,
      );

      return {
        week,
        weekStart: r.weekStart,
        phase,
        planned,
        completed,
        adherencePct,
        cyclingKm,
        isCurrent: r.id === current.id,
        isPast: r.weekStart < weekStart,
        isFuture: r.weekStart > weekStart,
      };
    });

    return { weeks, totalWeeks: total };
  },
);
