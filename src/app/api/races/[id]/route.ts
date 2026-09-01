import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DISCIPLINES = ["cycling", "running", "trail"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const existing = await prisma.race.findUnique({ where: { id } });
  if (!existing || existing.userId !== auth.userId) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, location, distanceKm, elevationM, discipline, startTime, estimatedHours, notes } = body;

  if (name !== undefined && (typeof name !== "string" || !name)) {
    return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
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

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (location !== undefined) data.location = location || null;
  if (distanceKm !== undefined) data.distanceKm = distanceKm === "" ? null : distanceKm;
  if (elevationM !== undefined) data.elevationM = elevationM === "" ? null : elevationM;
  if (discipline !== undefined) data.discipline = discipline;
  if (startTime !== undefined) data.startTime = startTime || null;
  if (estimatedHours !== undefined) data.estimatedHours = estimatedHours === "" ? null : estimatedHours;
  if (notes !== undefined) data.notes = notes || null;

  const race = await prisma.race.update({ where: { id }, data });
  return NextResponse.json(race);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const race = await prisma.race.findUnique({ where: { id } });
  if (!race || race.userId !== auth.userId) {
    return NextResponse.json({ error: "Race not found" }, { status: 404 });
  }

  await prisma.race.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
