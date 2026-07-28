/**
 * POST /api/strava/sync — called by cron every 30 min.
 * Fetches recent activities from Strava, caches them, computes aggregates.
 * Returns { added, updated, totalCached, weeksComputed, monthsComputed }.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/internal-auth";
import { syncStravaActivities, getSyncState } from "@/lib/strava-cache";

export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Optional: max pages param from cron (default 5 = up to 500 activities)
  const maxPages = parseInt(
    request.nextUrl.searchParams.get("max_pages") || "5",
  );

  try {
    const result = await syncStravaActivities(auth.userId, maxPages);
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    console.error("[Strava sync]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/strava/sync — returns sync state (when last synced, how many cached).
 */
export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const state = await getSyncState(auth.userId);
  return NextResponse.json({
    synced: state != null,
    lastSyncAt: state?.lastSyncAt ?? null,
    lastActivityDate: state?.lastActivityStartDate ?? null,
    totalCached: state?.totalCached ?? 0,
  });
}
