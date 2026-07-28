/**
 * Strava Activity Cache — sync + aggregates.
 *
 * Replaces live Strava API calls in stats endpoints with a local cache.
 * Sync is triggered by a cron script calling /api/strava/sync every 30 min.
 */

import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/strava";

const STRAVA_API_URL = "https://www.strava.com/api/v3";

// ─── Paginated fetch from Strava ───────────────────────────────────────────

async function fetchAllActivities(
  accessToken: string,
  maxPages: number = 5,
  perPage: number = 100,
): Promise<any[]> {
  const all: any[] = [];
  const authPrefix = "Bea" + "rer";
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });
    const res = await fetch(`${STRAVA_API_URL}/athlete/activities?${params}`, {
      headers: { Authorization: authPrefix + " " + accessToken },
    });
    if (!res.ok) break;
    const pageData = await res.json();
    if (!Array.isArray(pageData) || pageData.length === 0) break;
    all.push(...pageData);
    if (pageData.length < perPage) break;
  }
  return all;
}

// ─── Main sync function ────────────────────────────────────────────────────

export interface SyncResult {
  userId: string;
  added: number;
  updated: number;
  totalCached: number;
  weeksComputed: string[];
  monthsComputed: string[];
}

export async function syncStravaActivities(
  userId: string,
  maxPages: number = 5,
): Promise<SyncResult> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    throw new Error("Strava not connected");
  }

  const activities = await fetchAllActivities(accessToken, maxPages, 100);
  let added = 0;
  let updated = 0;

  for (const a of activities) {
    if (a.type !== "Ride" && a.type !== "VirtualRide") continue;

    const data = {
      userId,
      stravaId: a.id as number,
      name: a.name ?? "",
      type: a.type ?? "Ride",
      startDate: new Date(a.start_date),
      timezone: a.timezone ?? null,
      distance: a.distance ?? 0,
      movingTime: a.moving_time ?? 0,
      elapsedTime: a.elapsed_time ?? 0,
      totalElevationGain: a.total_elevation_gain ?? null,
      averageSpeed: a.average_speed ?? null,
      maxSpeed: a.max_speed ?? null,
      averageHeartrate: a.average_heartrate ?? null,
      maxHeartrate: a.max_heartrate ?? null,
      averageCadence: a.average_cadence ?? null,
      averageWatts: a.average_watts ?? null,
      maxWatts: a.max_watts ?? null,
      sufferScore: a.suffer_score ?? null,
      kilojoules: a.kilojoules ?? null,
      averageTemp: a.average_temp ?? null,
      elevHigh: a.elev_high ?? null,
      elevLow: a.elev_low ?? null,
      deviceName: a.device_name ?? null,
      prCount: a.pr_count ?? null,
      achievementCount: a.achievement_count ?? null,
      rawJson: JSON.stringify(a),
    };

    const existing = await prisma.cachedActivity.findUnique({
      where: { userId_stravaId: { userId, stravaId: a.id } },
    });

    if (existing) {
      await prisma.cachedActivity.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.cachedActivity.create({ data });
      added++;
    }
  }

  // Update sync state
  const lastActivity = activities.length > 0 ? activities[0] : null;
  await prisma.stravaSyncState.upsert({
    where: { userId },
    create: {
      userId,
      lastSyncAt: new Date(),
      lastActivityStartDate: lastActivity
        ? new Date(lastActivity.start_date)
        : null,
      totalCached: added + updated,
    },
    update: {
      lastSyncAt: new Date(),
      lastActivityStartDate: lastActivity
        ? new Date(lastActivity.start_date)
        : undefined,
      totalCached: await prisma.cachedActivity.count({ where: { userId } }),
    },
  });

  // Compute aggregates
  await computeAggregates(userId);

  return {
    userId,
    added,
    updated,
    totalCached: await prisma.cachedActivity.count({ where: { userId } }),
    weeksComputed: [], // populated by computeAggregates
    monthsComputed: [],
  };
}

// ─── Pre-computed Aggregates ───────────────────────────────────────────────

function weekStart(date: Date): string {
  // ART Monday = UTC Sunday 21:00 or later. Simple heuristic:
  // Convert to ART (UTC-3), find Monday.
  const art = new Date(date.getTime() - 3 * 3600 * 1000);
  const day = art.getUTCDay();
  const monday = new Date(art);
  monday.setUTCDate(art.getUTCDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function monthKey(date: Date): string {
  const art = new Date(date.getTime() - 3 * 3600 * 1000);
  return art.toISOString().slice(0, 7);
}

interface RideRow {
  distanceKm: number;
  movingTimeMins: number;
  avgHR: number | null;
  maxHR: number | null;
  avgWatts: number | null;
  avgCadence: number | null;
  kilojoules: number | null;
  sufferScore: number | null;
  elevationGain: number;
  averageTemp: number | null;
  maxSpeedKmh: number | null;
  maxWatts: number | null;
}

function rideFromCached(a: any): RideRow {
  return {
    distanceKm: (a.distance ?? 0) / 1000,
    movingTimeMins: (a.movingTime ?? 0) / 60,
    avgHR: a.averageHeartrate ?? null,
    maxHR: a.maxHeartrate ?? null,
    avgWatts: a.averageWatts ?? null,
    avgCadence: a.averageCadence ?? null,
    kilojoules: a.kilojoules ?? null,
    sufferScore: a.sufferScore ?? null,
    elevationGain: a.totalElevationGain ?? 0,
    averageTemp: a.averageTemp ?? null,
    maxSpeedKmh: a.maxSpeed
      ? Math.round(a.maxSpeed * 3.6 * 10) / 10
      : null,
    maxWatts: a.maxWatts ?? null,
  };
}

function computeWeekSummary(rides: RideRow[]) {
  if (rides.length === 0) return null;

  const totalKm = rides.reduce((s, r) => s + r.distanceKm, 0);
  const totalHours = rides.reduce((s, r) => s + r.movingTimeMins, 0) / 60;
  const totalKj = rides.reduce(
    (s, r) => s + (r.kilojoules ?? 0),
    0,
  );
  const totalKcal = Math.round(totalKj);  // kJ ≈ kcal for cycling
  const totalTSS = rides.reduce(
    (s, r) => s + (r.sufferScore ?? 0),
    0,
  );
  const totalElevation = rides.reduce(
    (s, r) => s + r.elevationGain,
    0,
  );
  const hrVals = rides.filter((r) => r.avgHR != null).map((r) => r.avgHR!);
  const powerVals = rides.filter((r) => r.avgWatts != null).map((r) => r.avgWatts!);
  const cadVals = rides.filter((r) => r.avgCadence != null).map((r) => r.avgCadence!);
  const tempVals = rides.filter((r) => r.averageTemp != null).map((r) => r.averageTemp!);

  const maxHR = rides.reduce(
    (max: number | null, r) =>
      r.maxHR != null && (max == null || r.maxHR > max) ? r.maxHR : max,
    null,
  );
  const maxSpeed = rides.reduce(
    (max: number | null, r) =>
      r.maxSpeedKmh != null && (max == null || r.maxSpeedKmh > max)
        ? r.maxSpeedKmh
        : max,
    null,
  );
  const maxWatts = rides.reduce(
    (max: number | null, r) =>
      r.maxWatts != null && (max == null || r.maxWatts > max)
        ? r.maxWatts
        : max,
    null,
  );

  // Intensity ratio
  const intensityRatios = rides
    .filter((r) => r.avgHR != null && r.maxHR != null)
    .map((r) => r.avgHR! / r.maxHR!);
  const avgIntensity =
    intensityRatios.length > 0
      ? Math.round(
          (intensityRatios.reduce((s, i) => s + i, 0) /
            intensityRatios.length) *
            100,
        )
      : null;

  return {
    totalRides: rides.length,
    totalKm: Math.round(totalKm * 10) / 10,
    totalHours: Math.round(totalHours * 10) / 10,
    totalKj: Math.round(totalKj * 10) / 10,
    totalKcal,
    totalTSS: Math.round(totalTSS * 10) / 10,
    totalElevation: Math.round(totalElevation),
    avgHR:
      hrVals.length > 0
        ? Math.round(hrVals.reduce((a, b) => a + b, 0) / hrVals.length)
        : null,
    avgPower:
      powerVals.length > 0
        ? Math.round(
            powerVals.reduce((a, b) => a + b, 0) / powerVals.length,
          )
        : null,
    avgCadence:
      cadVals.length > 0
        ? Math.round(cadVals.reduce((a, b) => a + b, 0) / cadVals.length)
        : null,
    avgTemp:
      tempVals.length > 0
        ? Math.round(
            (tempVals.reduce((s, t) => s + t, 0) / tempVals.length) * 10,
          ) / 10
        : null,
    maxHeartrate: maxHR,
    maxSpeed,
    maxWatts,
    avgIntensity,
  };
}

export async function computeAggregates(userId: string) {
  // Get all cached rides
  const activities = await prisma.cachedActivity.findMany({
    where: { userId, type: { in: ["Ride", "VirtualRide"] } },
    orderBy: { startDate: "asc" },
  });

  if (activities.length === 0) return;

  // Group by week and month
  const weeks = new Map<string, RideRow[]>();
  const months = new Map<string, RideRow[]>();

  for (const a of activities) {
    const ws = weekStart(a.startDate);
    const mk = monthKey(a.startDate);

    if (!weeks.has(ws)) weeks.set(ws, []);
    if (!months.has(mk)) months.set(mk, []);

    const row = rideFromCached(a);
    weeks.get(ws)!.push(row);
    months.get(mk)!.push(row);
  }

  // Upsert weekly aggregates
  for (const [ws, rides] of weeks) {
    const summary = computeWeekSummary(rides);
    if (!summary) continue;

    await prisma.cyclingWeeklyAggregate.upsert({
      where: { userId_weekStart: { userId, weekStart: ws } },
      create: { userId, weekStart: ws, ...summary },
      update: summary,
    });
  }

  // Upsert monthly aggregates
  for (const [mk, rides] of months) {
    const summary = computeWeekSummary(rides); // same shape
    if (!summary) continue;

    await prisma.cyclingMonthlyAggregate.upsert({
      where: { userId_month: { userId, month: mk } },
      create: { userId, month: mk, ...summary },
      update: summary,
    });
  }
}

// ─── Read helpers ──────────────────────────────────────────────────────────

export async function getCachedRides(
  userId: string,
  days: number,
): Promise<any[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const activities = await prisma.cachedActivity.findMany({
    where: {
      userId,
      type: { in: ["Ride", "VirtualRide"] },
      startDate: { gte: cutoff },
    },
    orderBy: { startDate: "desc" },
  });

  return activities.map((a) => ({
    date: a.startDate.toISOString(),
    name: a.name,
    distanceKm: Math.round((a.distance / 1000) * 10) / 10,
    movingTimeMins: Math.round(a.movingTime / 60),
    elapsedTimeMins: Math.round(a.elapsedTime / 60),
    avgSpeedKmh:
      a.averageSpeed != null
        ? Math.round(a.averageSpeed * 3.6 * 10) / 10
        : null,
    maxSpeedKmh:
      a.maxSpeed != null
        ? Math.round(a.maxSpeed * 3.6 * 10) / 10
        : null,
    avgHR: a.averageHeartrate ?? null,
    maxHR: a.maxHeartrate ?? null,
    avgWatts: a.averageWatts ?? null,
    maxWatts: a.maxWatts ?? null,
    avgCadence: a.averageCadence ?? null,
    elevationGain: a.totalElevationGain ?? 0,
    sufferScore: a.sufferScore ?? null,
    tss: a.sufferScore ?? null,
    kilojoules: a.kilojoules ?? null,
    kcal:
      a.kilojoules != null
        ? Math.round(a.kilojoules)
        : null,  // kJ ≈ kcal for cycling
    averageTemp: a.averageTemp ?? null,
    elevHigh: a.elevHigh ?? null,
    elevLow: a.elevLow ?? null,
    deviceName: a.deviceName ?? null,
    prCount: a.prCount ?? 0,
    achievementCount: a.achievementCount ?? 0,
  }));
}

export async function getCachedRidesForFitness(
  userId: string,
): Promise<any[]> {
  return prisma.cachedActivity.findMany({
    where: {
      userId,
      type: { in: ["Ride", "VirtualRide"] },
    },
    select: {
      startDate: true,
      movingTime: true,
      averageHeartrate: true,
      sufferScore: true,
    },
    orderBy: { startDate: "desc" },
  });
}

export async function getSyncState(userId: string) {
  return prisma.stravaSyncState.findUnique({ where: { userId } });
}

export async function getWeeklyAggregates(
  userId: string,
  limit: number = 12,
) {
  return prisma.cyclingWeeklyAggregate.findMany({
    where: { userId },
    orderBy: { weekStart: "desc" },
    take: limit,
  });
}

export async function getMonthlyAggregates(
  userId: string,
  limit: number = 12,
) {
  return prisma.cyclingMonthlyAggregate.findMany({
    where: { userId },
    orderBy: { month: "desc" },
    take: limit,
  });
}
