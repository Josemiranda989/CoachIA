import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken, fetchActivities, fetchStats } from "@/lib/strava";

// React.cache() deduplicates these calls within a single render pass.
// CyclingCards (Suspense boundary A) and StravaActivities (Suspense boundary B)
// can both trigger getStravaContext / getStravaStats — they execute exactly once.

export const getStravaContext = cache(
  async (userId: string): Promise<{ token: string; athleteId: string } | null> => {
    const token = await getValidAccessToken(userId);
    if (!token) return null;
    const athlete = await prisma.user.findUnique({
      where: { id: userId },
      select: { stravaAthleteId: true },
    });
    if (!athlete?.stravaAthleteId) return null;
    return { token, athleteId: athlete.stravaAthleteId };
  }
);

export const getStravaStats = cache(async (userId: string) => {
  const ctx = await getStravaContext(userId);
  if (!ctx) return null;
  try {
    return await fetchStats(ctx.token, ctx.athleteId);
  } catch {
    return null;
  }
});

export const getStravaActivities = cache(
  async (userId: string, page = 1, perPage = 10) => {
    const ctx = await getStravaContext(userId);
    if (!ctx) return [];
    try {
      return await fetchActivities(ctx.token, page, perPage);
    } catch {
      return [];
    }
  }
);
