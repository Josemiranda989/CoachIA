import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getValidAccessToken, fetchActivities, fetchStats } from "@/lib/strava";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const userId = (session as any).user.id;

  try {
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json({ error: "Strava no conectado" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stravaAthleteId: true },
    });

    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const perPage = parseInt(request.nextUrl.searchParams.get("per_page") || "10");

    const [activities, stats] = await Promise.all([
      fetchActivities(accessToken, page, perPage),
      user?.stravaAthleteId ? fetchStats(accessToken, user.stravaAthleteId) : null,
    ]);

    return NextResponse.json({ activities, stats });
  } catch (err: any) {
    console.error("[Strava activities]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
