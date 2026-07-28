/**
 * GET /api/stats/aggregates?type=weekly|monthly&limit=12
 *
 * Returns pre-computed cycling aggregates. Reads from cyclingWeeklyAggregate
 * or cyclingMonthlyAggregate — zero Strava API calls, < 50ms response.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/internal-auth";
import {
  getWeeklyAggregates,
  getMonthlyAggregates,
} from "@/lib/strava-cache";

export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "weekly";
  const limit = parseInt(searchParams.get("limit") ?? "12");

  try {
    if (type === "monthly") {
      const months = await getMonthlyAggregates(auth.userId, limit);
      return NextResponse.json({ type: "monthly", months });
    }

    const weeks = await getWeeklyAggregates(auth.userId, limit);
    return NextResponse.json({ type: "weekly", weeks });
  } catch (err: any) {
    console.error("Aggregates error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
