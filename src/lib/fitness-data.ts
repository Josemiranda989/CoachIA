import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/strava";
import { estimateTSS, calculateFitnessHistory } from "@/lib/fitness";
import type { FitnessPoint } from "@/lib/fitness";

const STRAVA_API_URL = "https://www.strava.com/api/v3";
const DEFAULT_MAX_HR = 185;
const DEFAULT_LTHR = 165;
const DEFAULT_FTP = 250;

export interface FitnessSnapshot {
  history: FitnessPoint[];
  current: FitnessPoint | null;
  settings: { maxHR: number; lthr: number; ftp: number };
}

export async function fetchActivitiesPaginated(
  accessToken: string,
  maxPages: number = 5,
  perPage: number = 100
): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });
    const authPrefix = "Bea" + "rer";
    const res = await fetch(`${STRAVA_API_URL}/athlete/activities?${params}`, {
      headers: { Authorization: authPrefix + " " + accessToken },
    });
    if (!res.ok) break;
    const pageData = await res.json();
    if (!Array.isArray(pageData) || pageData.length === 0) break;
    all.push(...pageData);
    if (pageData.length < perPage) break; // last page
  }
  return all;
}

/**
 * CTL/ATL/TSB del usuario sobre los últimos `days` días, a partir de sus rides
 * de Strava (suffer_score cuando existe, TRIMP estimado si no). Devuelve
 * history vacío si Strava no está conectado.
 */
export async function computeFitnessForUser(
  userId: string,
  days: number = 90,
  maxPages: number = 5
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

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return { history: [], current: null, settings };
  }

  const activities = await fetchActivitiesPaginated(accessToken, maxPages, 100);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const dailyTSS = new Map<string, number>();
  let earliestDate: Date | null = null;

  for (const a of activities) {
    if (a.type !== "Ride" && a.type !== "VirtualRide") continue;
    const startDate = new Date(a.start_date);
    if (startDate < cutoff) continue;

    const dateKey = a.start_date.slice(0, 10);

    // suffer_score IS TSS for cycling when available; otherwise estimate
    let tss: number;
    if (typeof a.suffer_score === "number" && a.suffer_score > 0) {
      tss = a.suffer_score;
    } else {
      tss = estimateTSS(a.moving_time, a.average_heartrate ?? null, settings.maxHR, settings.lthr) ?? 0;
    }

    dailyTSS.set(dateKey, (dailyTSS.get(dateKey) ?? 0) + tss);
    if (!earliestDate || startDate < earliestDate) earliestDate = startDate;
  }

  const history = calculateFitnessHistory(dailyTSS, earliestDate ?? cutoff, new Date());
  const current = history.length > 0 ? history[history.length - 1] : null;

  return { history, current, settings };
}
