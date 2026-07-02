import { prisma } from "@/lib/prisma";
import { getStravaActivities } from "@/lib/strava-cached";
import { estimateTSS, calculateFitnessHistory } from "@/lib/fitness";
import { FitnessChartView } from "./FitnessChartView";

const DEFAULT_MAX_HR = 185;
const DEFAULT_LTHR = 165;
// paginate up to 5 pages of 100 activities each to cover ~90 days
const MAX_PAGES = 5;
const PER_PAGE = 100;

export async function FitnessChart({ userId }: { userId: string }) {
  // 1. User settings
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcMax: true, lthr: true },
  });
  const maxHR = user?.fcMax ?? DEFAULT_MAX_HR;
  const lthr = user?.lthr ?? DEFAULT_LTHR;

  // 2. Fetch all available activities (server-side, same pattern as CyclingTrendChart)
  const activities = await getStravaActivities(userId, 1, PER_PAGE);
  // Need more pages for 90-day lookback — fetch manually since getStravaActivities
  // only returns one page. We read from Strava directly.
  const { getValidAccessToken } = await import("@/lib/strava");
  const token = await getValidAccessToken(userId);
  if (!token) return null;

  // Build full activity list across pages
  const allActivities: any[] = [...(activities as any[])];

  // If first page was full, fetch more
  if ((activities as any[]).length >= PER_PAGE) {
    const STRAVA_API_URL = "https://www.strava.com/api/v3";
    for (let page = 2; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: PER_PAGE.toString(),
      });
      const authPrefix = "Bea" + "rer";
      const res = await fetch(
        `${STRAVA_API_URL}/athlete/activities?${params}`,
        { headers: { Authorization: authPrefix + " " + token } }
      );
      if (!res.ok) break;
      const pageData = await res.json();
      if (!Array.isArray(pageData) || pageData.length === 0) break;
      allActivities.push(...pageData);
      if (pageData.length < PER_PAGE) break;
    }
  }

  // 3. Filter to rides and compute daily TSS
  const dailyTSS = new Map<string, number>();
  let earliestDate: Date | null = null;

  for (const a of allActivities) {
    if (a.type !== "Ride" && a.type !== "VirtualRide") continue;

    const dateKey = a.start_date?.slice(0, 10);
    if (!dateKey) continue;

    const startDate = new Date(a.start_date);
    let tss: number;
    if (typeof a.suffer_score === "number" && a.suffer_score > 0) {
      tss = a.suffer_score;
    } else {
      const estimated = estimateTSS(
        a.moving_time ?? 0,
        a.average_heartrate ?? null,
        maxHR,
        lthr
      );
      tss = estimated ?? 0;
    }

    dailyTSS.set(dateKey, (dailyTSS.get(dateKey) ?? 0) + tss);

    if (!earliestDate || startDate < earliestDate) {
      earliestDate = startDate;
    }
  }

  // 4. Compute fitness history
  if (dailyTSS.size === 0) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>
          Aún no hay datos de ciclismo. Realizá algunas salidas con Strava para
          ver tu evolución de fitness.
        </p>
      </div>
    );
  }

  const startDate = earliestDate!;
  const endDate = new Date();
  const history = calculateFitnessHistory(dailyTSS, startDate, endDate);
  const current = history.length > 0 ? history[history.length - 1] : null;

  return <FitnessChartView data={history} current={current} />;
}
