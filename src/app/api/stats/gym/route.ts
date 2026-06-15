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
        sessions: [],
        summary: null,
      });
    }

    // Fetch enough activities to cover the period
    const activities = await fetchActivities(accessToken, 1, 50);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Filter to WeightTraining sessions within the period
    const sessions = activities
      .filter(
        (a: any) =>
          a.type === "WeightTraining" && new Date(a.start_date) >= cutoff
      )
      .map((a: any) => ({
        date: a.start_date,
        name: a.name,
        movingTimeMins: Math.round(a.moving_time / 60),
        elapsedTimeMins: Math.round(a.elapsed_time / 60),
        avgHR: a.average_heartrate ?? null,
        maxHR: a.max_heartrate ?? null,
        deviceName: a.device_name ?? null,
        workoutType: a.workout_type ?? null,
      }));

    // Summary
    const totalMins = sessions.reduce(
      (sum: number, s: any) => sum + s.movingTimeMins,
      0
    );

    const avgHRs = sessions
      .map((s: any) => s.avgHR)
      .filter((hr: any): hr is number => hr !== null);

    const maxHRs = sessions
      .map((s: any) => s.maxHR)
      .filter((hr: any): hr is number => hr !== null);

    const longestSession = sessions.reduce(
      (max: any, s: any) =>
        s.movingTimeMins > (max?.movingTimeMins ?? 0) ? s : max,
      null
    );

    const summary = {
      period: `last ${days} days`,
      totalSessions: sessions.length,
      totalMinutes: totalMins,
      totalHours: Math.round((totalMins / 60) * 10) / 10,
      avgDurationPerSession:
        sessions.length > 0
          ? Math.round(totalMins / sessions.length)
          : 0,
      avgHR:
        avgHRs.length > 0
          ? Math.round(
              avgHRs.reduce((a: number, b: number) => a + b, 0) / avgHRs.length
            )
          : null,
      maxHR:
        maxHRs.length > 0 ? Math.max(...maxHRs) : null,
      weeklyFrequency:
        days >= 7
          ? Math.round((sessions.length / (days / 7)) * 10) / 10
          : sessions.length,
      longestSession: longestSession
        ? {
            date: longestSession.date,
            name: longestSession.name,
            movingTimeMins: longestSession.movingTimeMins,
            avgHR: longestSession.avgHR,
          }
        : null,
    };

    return NextResponse.json({ sessions, summary });
  } catch (err: any) {
    console.error("Gym stats error:", err);
    return NextResponse.json(
      { error: err.message, sessions: [], summary: null },
      { status: 500 }
    );
  }
}
