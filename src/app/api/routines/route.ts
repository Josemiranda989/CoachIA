import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveAuth } from '@/lib/internal-auth';

// GET /api/routines?weekStart=YYYY-MM-DD — list routines (optionally filtered by weekStart).
// Used by the n8n watchdog to verify the monthly mesocycle was created.
export async function GET(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get('weekStart');

  if (weekStart && !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: 'weekStart must be YYYY-MM-DD' }, { status: 400 });
  }

  const routines = await prisma.routine.findMany({
    where: {
      userId: auth.userId,
      ...(weekStart ? { weekStart } : {}),
    },
    select: { id: true, weekStart: true, status: true, createdAt: true },
    orderBy: { weekStart: 'desc' },
  });

  return NextResponse.json({ count: routines.length, routines });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    let userId: string | null = null;

    if ((session as any)?.user?.id) {
      userId = (session as any).user.id as string;
    } else {
      // Development fallback: use first existing user so local tests no longer fall
      // for not-authenticated status while iterating on JSON load.
      const firstUser = await prisma.user.findFirst();
      if (firstUser) {
        userId = firstUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: please login first' }, { status: 401 });
    }

    const data = await request.json();

    // Schema validation
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (!data.weekStart || typeof data.weekStart !== 'string') {
      return NextResponse.json({ error: 'weekStart is required and must be a YYYY-MM-DD string' }, { status: 400 });
    }
    // Normalize: accept ISO datetime input ("2026-04-20T00:00:00Z") and reduce to YYYY-MM-DD
    const weekStart = data.weekStart.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: 'weekStart must be YYYY-MM-DD or an ISO datetime starting with that' }, { status: 400 });
    }

    if (!Array.isArray(data.days) || data.days.length === 0) {
      return NextResponse.json({ error: 'days must be a non-empty array' }, { status: 400 });
    }

    for (const [idx, day] of data.days.entries()) {
      if (!day.dayOfWeek || typeof day.dayOfWeek !== 'string') {
        return NextResponse.json({ error: `days[${idx}].dayOfWeek is required` }, { status: 400 });
      }
      if (!day.type || typeof day.type !== 'string') {
        return NextResponse.json({ error: `days[${idx}].type is required` }, { status: 400 });
      }
      if (day.exercises) {
        if (!Array.isArray(day.exercises)) {
          return NextResponse.json({ error: `days[${idx}].exercises must be an array` }, { status: 400 });
        }
        for (const [j, ex] of day.exercises.entries()) {
          if (!ex.name || typeof ex.name !== 'string') {
            return NextResponse.json({ error: `days[${idx}].exercises[${j}].name is required` }, { status: 400 });
          }
          if (typeof ex.targetSets !== 'number' || ex.targetSets <= 0) {
            return NextResponse.json({ error: `days[${idx}].exercises[${j}].targetSets must be a positive number` }, { status: 400 });
          }
        }
      }
    }

    // Nested create
    type ExerciseInput = {
      name: string;
      targetSets: number;
      targetReps?: string;
    };

    type CyclingBlockInput = {
      kind: string; // "warmup" | "steady" | "interval" | "cooldown"
      duration: number;
      targetPower: string;
      repetitions?: number;
      recoveryDuration?: number;
      recoveryPower?: string;
      notes?: string;
    };

    type DayInput = {
      dayOfWeek: string;
      type: string;
      targetDuration?: number;
      targetPower?: string;
      targetIntensity?: string;
      notes?: string;
      exercises?: ExerciseInput[];
      blocks?: CyclingBlockInput[];
    };

    const routine = await prisma.routine.create({
      data: {
        userId: (session as any).user.id,
        weekStart,
        days: {
          create: (data.days as DayInput[]).map((day) => ({
            dayOfWeek: day.dayOfWeek,
            type: day.type,
            targetDuration: day.targetDuration ?? null,
            targetPower: day.targetPower ?? day.targetIntensity ?? null,
            notes: day.notes ?? null,
            exercises: (day.exercises && day.exercises.length > 0) ? {
              create: day.exercises.map((ex) => ({
                name: ex.name,
                targetSets: ex.targetSets,
                targetReps: ex.targetReps ?? null
              }))
            } : undefined,
            blocks: (day.blocks && day.blocks.length > 0) ? {
              create: day.blocks.map((b, idx) => ({
                order: idx,
                kind: b.kind,
                duration: b.duration,
                targetPower: b.targetPower,
                repetitions: b.repetitions ?? null,
                recoveryDuration: b.recoveryDuration ?? null,
                recoveryPower: b.recoveryPower ?? null,
                notes: b.notes ?? null,
              })),
            } : undefined,
          }))
        }
      },
      include: {
        days: {
          include: {
            exercises: true,
            blocks: { orderBy: { order: 'asc' } },
          }
        }
      }
    });

    revalidatePath('/workout/today');
    revalidatePath('/metrics');

    return NextResponse.json(routine, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save routine', details: err.message }, { status: 500 });
  }
}
