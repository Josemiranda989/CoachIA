import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { getCurrentWeekStart } from "@/lib/week";

// POST /api/cron/archive-stale-routines
// Archives any "active" routine whose weekStart is strictly before the current
// Monday. Designed to run daily so past-week routines don't linger as active
// between monthly mesocycle generations.
//
// Idempotent — repeated calls without new stale routines return count: 0.
export async function POST(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const currentWeekMonday = getCurrentWeekStart();

  const result = await prisma.routine.updateMany({
    where: {
      userId: auth.userId,
      status: "active",
      weekStart: { lt: currentWeekMonday },
    },
    data: { status: "archived" },
  });

  return NextResponse.json({
    archived: result.count,
    currentWeekMonday,
  });
}
