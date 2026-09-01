import "server-only";
import { prisma } from "@/lib/prisma";

const TIMEZONE_ART = "America/Argentina/Tucuman";

// YYYY-MM-DD de "hoy" en ART. Misma convención que getCurrentWeekStart:
// identificador String, no DateTime, para comparar con Race.date sin líos de
// filtro Prisma+SQLite.
export function todayArt(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE_ART,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Diferencia en días calendario entre dos YYYY-MM-DD (positiva si `to` es futuro).
// Ambas fechas ya son calendario-puro en ART, así que comparar a medianoche UTC
// es seguro (Argentina no tiene horario de verano).
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export type RacePhase = "BASE" | "BUILD" | "PEAK" | "TAPER" | "RACE" | "RECOVERY";

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Fase de periodización de una semana (weekStart = lunes YYYY-MM-DD) respecto
// a la fecha de una carrera. RACE es la semana calendario en la que cae la
// carrera; RECOVERY es cualquier semana posterior; BASE/BUILD/PEAK/TAPER son
// ventanas de cuenta regresiva antes de la carrera.
export function phaseForWeek(weekStart: string, raceDate: string): RacePhase {
  const sunday = addDaysYmd(weekStart, 6);
  if (raceDate < weekStart) return "RECOVERY";
  if (raceDate <= sunday) return "RACE";
  const daysToMonday = daysBetween(weekStart, raceDate);
  if (daysToMonday <= 13) return "TAPER";
  if (daysToMonday <= 27) return "PEAK";
  if (daysToMonday <= 55) return "BUILD";
  return "BASE";
}

export type RaceWithCountdown = {
  id: string;
  name: string;
  location: string | null;
  date: string;
  distanceKm: number | null;
  elevationM: number | null;
  discipline: string;
  notes: string | null;
  daysUntil: number;
};

function withCountdown(race: {
  id: string;
  name: string;
  location: string | null;
  date: string;
  distanceKm: number | null;
  elevationM: number | null;
  discipline: string;
  notes: string | null;
}, today: string): RaceWithCountdown {
  return { ...race, daysUntil: daysBetween(today, race.date) };
}

// Todas las carreras futuras (incluye hoy), ascendente por fecha. Usado por
// /races (calendario completo).
export async function getUpcomingRaces(userId: string): Promise<RaceWithCountdown[]> {
  const today = todayArt();
  const races = await prisma.race.findMany({
    where: { userId, date: { gte: today } },
    orderBy: { date: "asc" },
  });
  return races.map((r) => withCountdown(r, today));
}

// La próxima carrera nomás — usado por el countdown card del home.
export async function getNextRace(userId: string): Promise<RaceWithCountdown | null> {
  const today = todayArt();
  const race = await prisma.race.findFirst({
    where: { userId, date: { gte: today } },
    orderBy: { date: "asc" },
  });
  return race ? withCountdown(race, today) : null;
}
