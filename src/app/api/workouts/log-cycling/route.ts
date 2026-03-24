import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { workoutId, actualDuration, distance, averageHeartRate, rpe } = await request.json();

    if (!workoutId) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const updated = await prisma.dailyWorkout.update({
      where: { id: workoutId },
      data: {
        actualDuration,
        distance,
        averageHeartRate,
        rpe,
        completed: true,
        date: new Date()
      }
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
