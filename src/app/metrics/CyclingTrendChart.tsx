import { getStravaActivities } from "@/lib/strava-cached";
import { CyclingTrendChartView, type CyclingWeekData } from "./CyclingTrendChartView";

// Returns the YYYY-MM-DD of the Monday that starts the ISO week containing `date`.
function isoMondayKey(date: Date): string {
  const d = new Date(date);
  // JS getDay: Sunday=0..Saturday=6 — shift so Monday=0
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWeekLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export async function CyclingTrendChart({ userId }: { userId: string }) {
  // Pull a generous window — Strava paginates by activity count, not date,
  // so 100 covers ~12 weeks even for high-volume riders.
  const activities = await getStravaActivities(userId, 1, 100);
  const rides = ((activities as any[]) ?? []).filter(
    (a) => a.type === "Ride" || a.type === "VirtualRide",
  );

  // Build 12 contiguous weeks ending on current week (so empty weeks render as 0).
  const now = new Date();
  const currentMondayKey = isoMondayKey(now);
  const weeks: string[] = [];
  {
    const [y, m, d] = currentMondayKey.split("-").map(Number);
    const cursor = new Date(y, m - 1, d);
    for (let i = 0; i < 12; i++) {
      weeks.unshift(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
      );
      cursor.setDate(cursor.getDate() - 7);
    }
  }
  const oldestKey = weeks[0];

  const buckets: Record<string, { km: number; kj: number; minutes: number }> = {};
  for (const w of weeks) buckets[w] = { km: 0, kj: 0, minutes: 0 };

  for (const ride of rides) {
    const startedAt = new Date(ride.start_date);
    const key = isoMondayKey(startedAt);
    if (key < oldestKey) continue;
    if (!buckets[key]) continue;
    buckets[key].km += (ride.distance ?? 0) / 1000;
    buckets[key].kj += typeof ride.kilojoules === "number" ? ride.kilojoules : 0;
    buckets[key].minutes += (ride.moving_time ?? 0) / 60;
  }

  const data: CyclingWeekData[] = weeks.map((key) => ({
    weekStart: key,
    label: formatWeekLabel(key),
    km: Math.round(buckets[key].km * 10) / 10,
    kj: Math.round(buckets[key].kj),
    hours: Math.round((buckets[key].minutes / 60) * 10) / 10,
  }));

  return <CyclingTrendChartView data={data} />;
}

export { CyclingTrendChartSkeleton } from "./CyclingTrendChartView";
