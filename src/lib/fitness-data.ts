import { prisma } from "@/lib/prisma";
import { getCachedRidesForFitness } from "@/lib/strava-cache";
import { estimateTSS, calculateFitnessHistory } from "@/lib/fitness";
import type { FitnessPoint } from "@/lib/fitness";

const DEFAULT_MAX_HR = 185;
const DEFAULT_LTHR = 165;
const DEFAULT_FTP = 250;

export interface FitnessSnapshot {
  history: FitnessPoint[];
  current: FitnessPoint | null;
  settings: { maxHR: number; lthr: number; ftp: number };
}

/**
 * CTL/ATL/TSB from cached activities (no Strava API call).
 * Falls back to Strava live only when cache is empty.
 */
export async function computeFitnessForUser(
  userId: string,
  days: number = 90,
): Promise<FitnessSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcMax: true, lthr: true, ftp: true },
  });

  const settings = {
    maxHR: user?.fcMax ?? DEFAULT_MAX_HR,
    lthr: user?.lthr ?? DEFAULT_LTHR,
    ftp: user?.ftp ?? DEFAULT_FTP,
  };

  // Read from cache
  const cached = await getCachedRidesForFitness(userId);

  if (cached.length === 0) {
    return { history: [], current: null, settings };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const dailyTSS = new Map<string, number>();
  let earliestDate: Date | null = null;

  for (const a of cached) {
    const startDate = new Date(a.startDate);
    if (startDate < cutoff) continue;

    const dateKey = a.startDate.toISOString().slice(0, 10);

    let tss: number;
    if (typeof a.sufferScore === "number" && a.sufferScore > 0) {
      tss = a.sufferScore;
    } else {
      tss =
        estimateTSS(
          a.movingTime,
          (a.averageHeartrate as number | null) ?? null,
          settings.maxHR,
          settings.lthr,
        ) ?? 0;
    }

    dailyTSS.set(dateKey, (dailyTSS.get(dateKey) ?? 0) + tss);
    if (!earliestDate || startDate < earliestDate) earliestDate = startDate;
  }

  const history = calculateFitnessHistory(
    dailyTSS,
    earliestDate ?? cutoff,
    new Date(),
  );
  const current = history.length > 0 ? history[history.length - 1] : null;

  return { history, current, settings };
}
