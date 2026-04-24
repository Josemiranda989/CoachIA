import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentWeekStart } from '@/lib/week';

export async function POST(request: Request) {
  try {
    const { workoutId, logs } = await request.json();

    if (!workoutId || !Array.isArray(logs)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    for (const log of logs) {
      const existing = await prisma.workoutLog.findFirst({
        where: { exerciseId: log.exerciseId, setNumber: log.setNumber }
      });
      
      if (existing) {
        await prisma.workoutLog.update({
          where: { id: existing.id },
          data: { weight: log.weight, reps: log.reps }
        });
      } else {
        await prisma.workoutLog.create({
          data: {
            exerciseId: log.exerciseId,
            setNumber: log.setNumber,
            reps: log.reps,
            weight: log.weight
          }
        });
      }
    }

    await prisma.dailyWorkout.update({
      where: { id: workoutId },
      data: { date: new Date() }
    });

    const weekStart = getCurrentWeekStart();
    const now = new Date();
    await prisma.workoutCompletion.upsert({
      where: { dailyWorkoutId_weekStart: { dailyWorkoutId: workoutId, weekStart } },
      update: { completed: true, completedAt: now },
      create: { dailyWorkoutId: workoutId, weekStart, completed: true, creatineTaken: false, completedAt: now },
    });

    return NextResponse.json({ success: true, count: logs.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
