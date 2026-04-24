const TIMEZONE = "America/Argentina/Tucuman";

/**
 * Returns YYYY-MM-DD of the Monday of the current week in America/Argentina/Tucuman.
 * Stored as a String identifier (not a timestamp) to avoid Prisma+SQLite DateTime
 * filter format quirks.
 */
export function getCurrentWeekStart(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const weekday = get("weekday");
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  const weekdayIndex: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };
  const offset = weekdayIndex[weekday] ?? 0;

  const monday = new Date(Date.UTC(year, month - 1, day - offset));
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
