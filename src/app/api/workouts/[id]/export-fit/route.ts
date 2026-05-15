import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blocksToFitWorkout } from "@/lib/fit-exporter";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: dailyWorkoutId } = await params;

  const [day, hrUser] = await Promise.all([
    prisma.dailyWorkout.findUnique({
      where: { id: dailyWorkoutId },
      include: {
        routine: true,
        blocks: { orderBy: { order: "asc" } },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id as string },
      select: { fcMax: true, lthr: true },
    }),
  ]);

  if (!day) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 });
  }
  if (day.routine.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (day.blocks.length === 0) {
    return NextResponse.json(
      { error: "No cycling blocks to export for this day" },
      { status: 400 }
    );
  }

  const dayEs = DAY_SHORT_ES[day.dayOfWeek] ?? day.dayOfWeek.toLowerCase();
  const dayDate = addDays(day.routine.weekStart, DAY_OFFSET[day.dayOfWeek] ?? 0);
  const filename = `${dayDate}-${dayEs}-coachia.fit`;
  const wktName = `CoachIA ${dayEs}`;

  let bytes: Uint8Array;
  try {
    bytes = blocksToFitWorkout({
      name: wktName,
      blocks: day.blocks,
      hrConfig: hrUser ? { fcMax: hrUser.fcMax, lthr: hrUser.lthr } : undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to encode .fit", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ant.fit",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
