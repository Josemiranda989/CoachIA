import { NextResponse } from "next/server";
import { resolveAuth } from "@/lib/internal-auth";
import { getCachedRides, getSyncState } from "@/lib/strava-cache";

/**
 * GET /api/stats/cycling?days=30
 *
 * CACHE-FIRST: reads from CachedActivity table (populated by /api/strava/sync
 * cron). Falls back to live Strava call only when cache is empty or stale >1h.
 */
export async function GET(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") ?? "30");

  try {
    const state = await getSyncState(auth.userId);

    // Use cache if it exists and was synced within the last 2 hours
    if (state && state.totalCached > 0) {
      const rides = await getCachedRides(auth.userId, days);

      // Build summary from cached rides
      const totalKm = rides.reduce(
        (sum: number, r: any) => sum + r.distanceKm,
        0,
      );
      const totalMins = rides.reduce(
        (sum: number, r: any) => sum + r.movingTimeMins,
        0,
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
      const kjs = rides
        .map((r: any) => r.kilojoules)
        .filter((k: any): k is number => k !== null);
      const totalKj = kjs.reduce((s: number, k: number) => s + k, 0);
      const totalKcal = Math.round(totalKj * 0.239 * 10) / 10;
      const sufferScores = rides
        .map((r: any) => r.sufferScore)
        .filter((s: any): s is number => s !== null);
      const totalSuffer = sufferScores.reduce(
        (s: number, sc: number) => s + sc,
        0,
      );
      const temps = rides
        .map((r: any) => r.averageTemp)
        .filter((t: any): t is number => t !== null);

      const longestRide = rides.reduce(
        (max: any, r: any) =>
          r.distanceKm > (max?.distanceKm ?? 0) ? r : max,
        null,
      );

      const peaks = {
        maxHeartrate: rides.reduce(
          (max: number | null, r: any) =>
            r.maxHR != null && (max == null || r.maxHR > max) ? r.maxHR : max,
          null as number | null,
        ),
        maxSpeed: rides.reduce(
          (max: number | null, r: any) =>
            r.maxSpeedKmh != null &&
            (max == null || r.maxSpeedKmh > max)
              ? r.maxSpeedKmh
              : max,
          null as number | null,
        ),
        maxWatts: rides.reduce(
          (max: number | null, r: any) =>
            r.maxWatts != null &&
            (max == null || r.maxWatts > max)
              ? r.maxWatts
              : max,
          null as number | null,
        ),
      };

      const elevHigh = rides.reduce(
        (max: number | null, r: any) =>
          r.elevHigh != null && (max == null || r.elevHigh > max)
            ? r.elevHigh
            : max,
        null as number | null,
      );
      const elevLow = rides.reduce(
        (min: number | null, r: any) =>
          r.elevLow != null && (min == null || r.elevLow < min)
            ? r.elevLow
            : min,
        null as number | null,
      );

      const intensityRatios = rides
        .filter((r: any) => r.avgHR != null && r.maxHR != null)
        .map((r: any) => r.avgHR / r.maxHR);
      const avgIntensity =
        intensityRatios.length > 0
          ? Math.round(
              (intensityRatios.reduce((s: number, i: number) => s + i, 0) /
                intensityRatios.length) *
                100,
            )
          : null;

      const summary = {
        period: `last ${days} days`,
        totalRides: rides.length,
        totalKm: Math.round(totalKm * 10) / 10,
        totalHours: Math.round((totalMins / 60) * 10) / 10,
        avgDistancePerRide:
          rides.length > 0
            ? Math.round((totalKm / rides.length) * 10) / 10
            : 0,
        avgHR:
          avgHRs.length > 0
            ? Math.round(
                avgHRs.reduce((a: number, b: number) => a + b, 0) /
                  avgHRs.length,
              )
            : null,
        avgPower:
          avgWatts.length > 0
            ? Math.round(
                avgWatts.reduce((a: number, b: number) => a + b, 0) /
                  avgWatts.length,
              )
            : null,
        avgCadence:
          avgCadences.length > 0
            ? Math.round(
                avgCadences.reduce((a: number, b: number) => a + b, 0) /
                  avgCadences.length,
              )
            : null,
        totalElevation: Math.round(
          rides.reduce(
            (sum: number, r: any) => sum + r.elevationGain,
            0,
          ),
        ),
        totalKj: Math.round(totalKj * 10) / 10,
        avgKjPerRide:
          kjs.length > 0
            ? Math.round((totalKj / kjs.length) * 10) / 10
            : null,
        totalKcal,
        avgKcalPerRide:
          kjs.length > 0
            ? Math.round((totalKcal / kjs.length) * 10) / 10
            : null,
        totalSufferScore: Math.round(totalSuffer * 10) / 10,
        avgTemp:
          temps.length > 0
            ? Math.round(
                (temps.reduce((s: number, t: number) => s + t, 0) /
                  temps.length) *
                  10,
              ) / 10
            : null,
        maxHeartrate: peaks.maxHeartrate,
        maxSpeed: peaks.maxSpeed,
        maxWatts: peaks.maxWatts,
        elevHigh,
        elevLow,
        avgIntensity,
        longestRide: longestRide
          ? {
              date: longestRide.date,
              distanceKm: longestRide.distanceKm,
              movingTimeMins: longestRide.movingTimeMins,
            }
          : null,
        _source: "cache",
        _syncedAt: state.lastSyncAt,
      };

      return NextResponse.json({ rides, summary });
    }

    // Fallback: cache empty — return empty but signal that sync is needed
    return NextResponse.json({
      rides: [],
      summary: null,
      error: "Strava not connected or cache not synced yet",
      _source: "empty",
    });
  } catch (err: any) {
    console.error("Cycling stats error:", err);
    return NextResponse.json(
      { error: err.message, rides: [], summary: null },
      { status: 500 },
    );
  }
}
