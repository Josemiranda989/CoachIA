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
      .map((a: any) => ({
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
        elevationGain: a.total_elevation_gain ?? 0,
        sufferScore: a.suffer_score ?? null,
      }));

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

    const longestRide = rides.reduce(
      (max: any, r: any) => (r.distanceKm > (max?.distanceKm ?? 0) ? r : max),
      null
    );

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
      totalElevation: Math.round(
        rides.reduce((sum: number, r: any) => sum + r.elevationGain, 0)
      ),
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
