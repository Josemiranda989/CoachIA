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
