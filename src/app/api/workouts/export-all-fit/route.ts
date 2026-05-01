import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAuth } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";
import { blocksToFitWorkout } from "@/lib/fit-exporter";
import { createZip } from "@/lib/zip-export";

const DAY_SHORT_ES: Record<string, string> = {
  Monday: "lun",
  Tuesday: "mar",
  Wednesday: "mie",
  Thursday: "jue",
  Friday: "vie",
  Saturday: "sab",
  Sunday: "dom",
};

const DAY_OFFSET: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

function addDays(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // Try internal API key first (for cron / automation), fallback to session
  const internalAuth = await resolveAuth(req);
  let userId: string;

  if (internalAuth.authenticated) {
    userId = internalAuth.userId;
  } else {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = (session as any).user.id;
  }

  // Obtener rutinas activas + pendientes de aprobación
  const routines = await prisma.routine.findMany({
    where: {
      userId,
      status: { in: ["active", "pending_approval"] },
    },
    include: {
      days: {
        where: {
          type: { in: ["Cycling", "Gym + Cycling"] },
          blocks: { some: {} },
        },
        include: {
          blocks: { orderBy: { order: "asc" } },
        },
      },
    },
    orderBy: { weekStart: "asc" },
  });

  const entries: { name: string; data: Buffer }[] = [];

  for (const routine of routines) {
    for (const day of routine.days) {
      const dayEs = DAY_SHORT_ES[day.dayOfWeek] ?? day.dayOfWeek.toLowerCase();
      const dayDate = addDays(routine.weekStart, DAY_OFFSET[day.dayOfWeek] ?? 0);
      const filename = `${dayDate}-${dayEs}-coachia.fit`;
      const wktName = `CoachIA ${dayEs}`;

      try {
        const bytes = blocksToFitWorkout({ name: wktName, blocks: day.blocks });
        entries.push({ name: filename, data: Buffer.from(bytes) });
      } catch (err: any) {
        console.error(`Error exporting ${filename}:`, err?.message ?? String(err));
        // Skip individual failures, continue with others
      }
    }
  }

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "No cycling workouts found to export" },
      { status: 404 },
    );
  }

  const zipBuffer = createZip(entries);
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="coachia-cycling-${dateStr}.zip"`,
      "Content-Length": String(zipBuffer.length),
      "Cache-Control": "no-store",
    },
  });
}
