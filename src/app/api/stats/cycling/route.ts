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
  const days = parseInt(searchParams.get("days") ?? "30");

  try {
    const accessToken = await getValidAccessToken(auth.userId);
    if (!accessToken) {
      return NextResponse.json({
        error: "Strava not connected",
        rides: [],
        summary: null,
      });
    }

    // Fetch last N activities (enough to cover the period)
    const activities = await fetchActivities(accessToken, 1, 50);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Filter to rides within the period
    const rides = activities
      .filter(
        (a: any) =>
          a.type === "Ride" && new Date(a.start_date) >= cutoff
      )
      .map((a: any) => {
        const kj = a.kilojoules ?? null;
        return {
          date: a.start_date,
          name: a.name,
          distanceKm: Math.round((a.distance / 1000) * 10) / 10,
          movingTimeMins: Math.round(a.moving_time / 60),
          elapsedTimeMins: Math.round(a.elapsed_time / 60),
          avgSpeedKmh: Math.round(a.average_speed * 3.6 * 10) / 10,
          maxSpeedKmh: Math.round(a.max_speed * 3.6 * 10) / 10,
          avgHR: a.average_heartrate ?? null,
          maxHR: a.max_heartrate ?? null,
          avgWatts: a.average_watts ?? null,
          maxWatts: a.max_watts ?? null,
          avgCadence: a.average_cadence ?? null,
          elevationGain: a.total_elevation_gain ?? 0,
          sufferScore: a.suffer_score ?? null,
          kilojoules: kj,
          kcal: kj !== null ? Math.round(kj * 0.239 * 10) / 10 : null,
          averageTemp: a.average_temp ?? null,
          elevHigh: a.elev_high ?? null,
          elevLow: a.elev_low ?? null,
          deviceName: a.device_name ?? null,
          prCount: a.pr_count ?? 0,
          achievementCount: a.achievement_count ?? 0,
        };
      });

    // Summary
    const totalKm = rides.reduce(
      (sum: number, r: any) => sum + r.distanceKm,
      0
    );
    const totalMins = rides.reduce(
      (sum: number, r: any) => sum + r.movingTimeMins,
      0
    );
    const avgHRs = rides
      .map((r: any) => r.avgHR)
      .filter((hr: any): hr is number => hr !== null);
    const avgWatts = rides
      .map((r: any) => r.avgWatts)
      .filter((w: any): w is number => w !== null);
    const avgCadences = rides
      .map((r: any) => r.avgCadence)
      .filter((c: any): c is number => c !== null);

    const longestRide = rides.reduce(
      (max: any, r: any) => (r.distanceKm > (max?.distanceKm ?? 0) ? r : max),
      null
    );

    // New metrics: energy (kJ/kcal), suffer score, temperature, elevation range, peaks
    const kjs = rides.map((r: any) => r.kilojoules).filter((k: any): k is number => k !== null);
    const totalKj = kjs.reduce((s: number, k: number) => s + k, 0);
    const totalKcal = Math.round(totalKj * 0.239 * 10) / 10;
    const sufferScores = rides.map((r: any) => r.sufferScore).filter((s: any): s is number => s !== null);
    const totalSuffer = sufferScores.reduce((s: number, sc: number) => s + sc, 0);
    const temps = rides.map((r: any) => r.averageTemp).filter((t: any): t is number => t !== null);
    const peaks = {
      maxHeartrate: rides.reduce((max: number | null, r: any) =>
        r.maxHR != null && (max == null || r.maxHR > max) ? r.maxHR : max, null as number | null),
      maxSpeed: rides.reduce((max: number | null, r: any) =>
        r.maxSpeedKmh != null && (max == null || r.maxSpeedKmh > max) ? r.maxSpeedKmh : max, null as number | null),
      maxWatts: rides.reduce((max: number | null, r: any) =>
        r.maxWatts != null && (max == null || r.maxWatts > max) ? r.maxWatts : max, null as number | null),
    };
    const elevHigh = rides.reduce((max: number | null, r: any) =>
      r.elevHigh != null && (max == null || r.elevHigh > max) ? r.elevHigh : max, null as number | null);
    const elevLow = rides.reduce((min: number | null, r: any) =>
      r.elevLow != null && (min == null || r.elevLow < min) ? r.elevLow : min, null as number | null);

    // Intensity: average ratio of avgHR / maxHR per ride
    const intensityRatios = rides
      .filter((r: any) => r.avgHR != null && r.maxHR != null)
      .map((r: any) => r.avgHR / r.maxHR);
    const avgIntensity = intensityRatios.length > 0
      ? Math.round(intensityRatios.reduce((s: number, i: number) => s + i, 0) / intensityRatios.length * 100)
      : null;

    const summary = {
      period: `last ${days} days`,
      totalRides: rides.length,
      totalKm: Math.round(totalKm * 10) / 10,
      totalHours: Math.round((totalMins / 60) * 10) / 10,
      avgDistancePerRide:
        rides.length > 0 ? Math.round((totalKm / rides.length) * 10) / 10 : 0,
      avgHR:
        avgHRs.length > 0
          ? Math.round(avgHRs.reduce((a: number, b: number) => a + b, 0) / avgHRs.length)
          : null,
      avgPower:
        avgWatts.length > 0
          ? Math.round(
              avgWatts.reduce((a: number, b: number) => a + b, 0) / avgWatts.length
            )
          : null,
      avgCadence:
        avgCadences.length > 0
          ? Math.round(
              avgCadences.reduce((a: number, b: number) => a + b, 0) / avgCadences.length
            )
          : null,
      totalElevation: Math.round(
        rides.reduce((sum: number, r: any) => sum + r.elevationGain, 0)
      ),
      // Energy
      totalKj: Math.round(totalKj * 10) / 10,
      avgKjPerRide: kjs.length > 0 ? Math.round(totalKj / kjs.length * 10) / 10 : null,
      totalKcal,
      avgKcalPerRide: kjs.length > 0 ? Math.round(totalKcal / kjs.length * 10) / 10 : null,
      // Suffer score
      totalSufferScore: Math.round(totalSuffer * 10) / 10,
      // Temperature
      avgTemp: temps.length > 0
        ? Math.round(temps.reduce((s: number, t: number) => s + t, 0) / temps.length * 10) / 10
        : null,
      // Peaks
      maxHeartrate: peaks.maxHeartrate,
      maxSpeed: peaks.maxSpeed,
      maxWatts: peaks.maxWatts,
      // Elevation range
      elevHigh,
      elevLow,
      // Intensity
      avgIntensity,
      longestRide: longestRide
        ? {
            date: longestRide.date,
            distanceKm: longestRide.distanceKm,
            movingTimeMins: longestRide.movingTimeMins,
          }
        : null,
    };

    return NextResponse.json({ rides, summary });
  } catch (err: any) {
    console.error("Cycling stats error:", err);
    return NextResponse.json(
      { error: err.message, rides: [], summary: null },
      { status: 500 }
    );
  }
}
