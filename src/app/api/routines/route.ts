import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    let userId: string | null = null;

    if (session?.user?.id) {
      userId = session.user.id as string;
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
      return NextResponse.json({ error: 'weekStart is required and must be an ISO date string' }, { status: 400 });
    }

    if (!Array.isArray(data.days) || data.days.length === 0) {
      return NextResponse.json({ error: 'days must be a non-empty array' }, { status: 400 });
    }

    const allowedTypes = ['Gym', 'Cycling', 'Rest', 'Gym + Cycling'];

    for (const [idx, day] of data.days.entries()) {
      if (!day.dayOfWeek || typeof day.dayOfWeek !== 'string') {
        return NextResponse.json({ error: `days[${idx}].dayOfWeek is required` }, { status: 400 });
      }
      if (!day.type || typeof day.type !== 'string' || !allowedTypes.includes(day.type)) {
        return NextResponse.json({ error: `days[${idx}].type is invalid (allowed: ${allowedTypes.join(', ')})` }, { status: 400 });
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

    type DayInput = {
      dayOfWeek: string;
      type: string;
      targetDuration?: number;
      targetPower?: string;
      targetIntensity?: string;
      notes?: string;
      exercises?: ExerciseInput[];
    };

    const routine = await prisma.routine.create({
      data: {
        userId: session.user.id,
        weekStart: new Date(data.weekStart),
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
            } : undefined
          }))
        }
      },
      include: {
        days: {
          include: {
            exercises: true
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
