import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { getUpcomingRaces } from "@/lib/queries/getRaces";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DISCIPLINES = ["cycling", "running", "trail"];

export async function GET(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const races = await getUpcomingRaces(auth.userId);
  return NextResponse.json(races);
}

export async function POST(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { name, date, startTime, estimatedHours, location, distanceKm, elevationM, discipline, notes } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!date || typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "date is required as YYYY-MM-DD" }, { status: 400 });
  }
  if (startTime !== undefined && startTime !== null && !TIME_RE.test(startTime)) {
    return NextResponse.json({ error: "startTime must be HH:MM (24h)" }, { status: 400 });
  }
  if (discipline !== undefined && !DISCIPLINES.includes(discipline)) {
    return NextResponse.json(
      { error: `discipline must be one of: ${DISCIPLINES.join(", ")}` },
      { status: 400 }
    );
  }

  const race = await prisma.race.create({
    data: {
      userId: auth.userId,
      name,
      date,
      startTime: startTime ?? null,
      estimatedHours: estimatedHours ?? null,
      location: location ?? null,
      distanceKm: distanceKm ?? null,
      elevationM: elevationM ?? null,
      discipline: discipline ?? "cycling",
      notes: notes ?? null,
    },
  });

  return NextResponse.json(race, { status: 201 });
}
