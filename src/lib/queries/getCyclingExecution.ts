import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getStravaContext } from "@/lib/strava-cached";
import { fetchActivities, fetchActivityStreams } from "@/lib/strava";
import {
  analyzeCyclingExecution,
  type BlockExecution,
} from "@/lib/cycling-execution";

export type CyclingExecutionReport = {
  blocks: BlockExecution[] | null;
  activity: {
    id: number;
    name: string;
    distanceKm: number;
    durationMin: number;
    avgHr: number | null;
  } | null;
  reason?: "no_blocks" | "no_hr_config" | "no_strava" | "no_activity" | "no_hr_stream";
};

const DAY_OFFSET: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

function addDays(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type RideActivity = {
  id: number;
  name: string;
  type: string;
  start_date_local: string;
  distance?: number;
  moving_time?: number;
  average_heartrate?: number;
};

function pickMatchingRide(
  activities: RideActivity[],
  targetYmd: string,
): RideActivity | null {
  const sameDay = activities.filter(
    (a) =>
      (a.type === "Ride" || a.type === "VirtualRide") &&
      a.start_date_local?.startsWith(targetYmd),
  );
  if (sameDay.length === 0) return null;
  sameDay.sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0));
  return sameDay[0];
}

export const getCyclingExecutionReport = cache(
  async (userId: string, dailyWorkoutId: string): Promise<CyclingExecutionReport | null> => {
    const day = await prisma.dailyWorkout.findUnique({
      where: { id: dailyWorkoutId },
      include: {
        routine: { select: { weekStart: true, userId: true } },
        blocks: { orderBy: { order: "asc" } },
      },
    });
    if (!day || day.routine.userId !== userId) return null;
    if (day.blocks.length === 0) {
      return { blocks: null, activity: null, reason: "no_blocks" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcMax: true, lthr: true },
    });
    if (!user || (!user.fcMax && !user.lthr)) {
      return { blocks: null, activity: null, reason: "no_hr_config" };
    }
    const hrConfig = { fcMax: user.fcMax, lthr: user.lthr };

    const ctx = await getStravaContext(userId);
    if (!ctx) return { blocks: null, activity: null, reason: "no_strava" };

    const dayOffset = DAY_OFFSET[day.dayOfWeek] ?? 0;
    const targetYmd = addDays(day.routine.weekStart, dayOffset);
    const activities = (await fetchActivities(ctx.token, 1, 30)) as RideActivity[];
    const ride = pickMatchingRide(activities, targetYmd);
    if (!ride) return { blocks: null, activity: null, reason: "no_activity" };

    const activitySummary = {
      id: ride.id,
      name: ride.name,
      distanceKm: Math.round((ride.distance ?? 0) / 100) / 10,
      durationMin: Math.round((ride.moving_time ?? 0) / 60),
      avgHr: ride.average_heartrate ? Math.round(ride.average_heartrate) : null,
    };

    let streams;
    try {
      streams = await fetchActivityStreams(ctx.token, ride.id, ["heartrate", "time"]);
    } catch {
      return { blocks: null, activity: activitySummary, reason: "no_hr_stream" };
    }
    const hrStream = streams?.heartrate?.data;
    if (!hrStream || hrStream.length === 0) {
      return { blocks: null, activity: activitySummary, reason: "no_hr_stream" };
    }

    const blocks = analyzeCyclingExecution({
      blocks: day.blocks.map((b) => ({
        order: b.order,
        kind: b.kind,
        duration: b.duration,
        targetPower: b.targetPower,
        repetitions: b.repetitions,
        recoveryDuration: b.recoveryDuration,
      })),
      hrStream,
      hrConfig,
    });

    return { blocks, activity: activitySummary };
  },
);
