import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getStravaContext } from "@/lib/strava-cached";
import { fetchActivities, fetchActivityStreams } from "@/lib/strava";
import { parseCadenceTarget } from "@/lib/fit-exporter";
import {
  detectSpinDrill,
  type DrillDetection,
  type DrillSpec,
} from "@/lib/drill-detector";

export type DrillReport = {
  drill: DrillSpec | null;
  activity: { id: number; name: string; distanceKm: number; durationMin: number } | null;
  detection: DrillDetection | null;
  reason?: "no_drill" | "no_strava" | "no_activity" | "no_streams";
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
};

function pickMatchingRide(
  activities: RideActivity[],
  saturdayYmd: string,
): RideActivity | null {
  const sameDay = activities.filter(
    (a) =>
      (a.type === "Ride" || a.type === "VirtualRide") &&
      a.start_date_local?.startsWith(saturdayYmd),
  );
  if (sameDay.length === 0) return null;
  // Multiple rides on the same Saturday — the prescribed long ride is the
  // longest one. Indoor warmups / commutes shouldn't outrank the real long ride.
  sameDay.sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0));
  return sameDay[0];
}

export const getSaturdayDrillReport = cache(
  async (userId: string, dailyWorkoutId: string): Promise<DrillReport | null> => {
    const day = await prisma.dailyWorkout.findUnique({
      where: { id: dailyWorkoutId },
      include: {
        routine: { select: { weekStart: true, userId: true } },
        blocks: { orderBy: { order: "asc" } },
      },
    });
    if (!day || day.routine.userId !== userId) return null;
    if (day.dayOfWeek !== "Saturday") return null;

    // Find the drill block: kind=interval with parseable cadence range and a
    // rep count. There should be at most one drill block per day per the prompt.
    let drill: DrillSpec | null = null;
    for (const b of day.blocks) {
      if (b.kind !== "interval" || !b.targetCadence || !b.repetitions) continue;
      const range = parseCadenceTarget(b.targetCadence);
      if (!range) continue;
      drill = {
        durationMin: b.duration,
        repetitions: b.repetitions,
        targetCadenceLow: range.low,
        targetCadenceHigh: range.high,
        recoveryDurationMin: b.recoveryDuration ?? 0,
      };
      break;
    }
    if (!drill) return { drill: null, activity: null, detection: null, reason: "no_drill" };

    const ctx = await getStravaContext(userId);
    if (!ctx) return { drill, activity: null, detection: null, reason: "no_strava" };

    const saturdayYmd = addDays(day.routine.weekStart, DAY_OFFSET[day.dayOfWeek] ?? 5);
    const activities = (await fetchActivities(ctx.token, 1, 30)) as RideActivity[];
    const ride = pickMatchingRide(activities, saturdayYmd);
    if (!ride) return { drill, activity: null, detection: null, reason: "no_activity" };

    const activitySummary = {
      id: ride.id,
      name: ride.name,
      distanceKm: Math.round((ride.distance ?? 0) / 100) / 10,
      durationMin: Math.round((ride.moving_time ?? 0) / 60),
    };

    let streams;
    try {
      streams = await fetchActivityStreams(ctx.token, ride.id, ["cadence", "time"]);
    } catch {
      return { drill, activity: activitySummary, detection: null, reason: "no_streams" };
    }
    const cadenceStream = streams?.cadence?.data;
    if (!cadenceStream || cadenceStream.length === 0) {
      return { drill, activity: activitySummary, detection: null, reason: "no_streams" };
    }

    const detection = detectSpinDrill({ cadenceStream, drill });
    return { drill, activity: activitySummary, detection };
  },
);
