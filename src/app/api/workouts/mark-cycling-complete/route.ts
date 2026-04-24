import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentWeekStart } from '@/lib/week';

export async function POST(request: Request) {
  try {
    const { workoutId } = await request.json();

    if (!workoutId) {
      return NextResponse.json({ error: 'workoutId is required' }, { status: 400 });
    }

    await prisma.dailyWorkout.update({
      where: { id: workoutId },
      data: { date: new Date() },
    });

    const weekStart = getCurrentWeekStart();
    const now = new Date();
    const upserted = await prisma.workoutCompletion.upsert({
      where: { dailyWorkoutId_weekStart: { dailyWorkoutId: workoutId, weekStart } },
      update: { completed: true, completedAt: now },
      create: { dailyWorkoutId: workoutId, weekStart, completed: true, creatineTaken: false, completedAt: now },
    });

    return NextResponse.json(upserted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
