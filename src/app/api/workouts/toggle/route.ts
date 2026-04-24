import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentWeekStart } from '@/lib/week';

export async function POST(request: Request) {
  try {
    const { workoutId, field, value } = await request.json();

    if (!workoutId || !field) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    if (field !== 'completed' && field !== 'creatineTaken') {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    const weekStart = getCurrentWeekStart();
    const completedAt = field === 'completed' && value ? new Date() : undefined;

    const updateData: { completed?: boolean; creatineTaken?: boolean; completedAt?: Date | null } = {
      [field]: value,
    };
    if (field === 'completed') {
      updateData.completedAt = value ? new Date() : null;
    }

    const upserted = await prisma.workoutCompletion.upsert({
      where: { dailyWorkoutId_weekStart: { dailyWorkoutId: workoutId, weekStart } },
      update: updateData,
      create: {
        dailyWorkoutId: workoutId,
        weekStart,
        completed: field === 'completed' ? value : false,
        creatineTaken: field === 'creatineTaken' ? value : false,
        completedAt: completedAt ?? null,
      },
    });

    revalidatePath('/routine/week');
    revalidatePath('/metrics');

    return NextResponse.json(upserted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
