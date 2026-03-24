import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { workoutId, field, value } = await request.json();

    if (!workoutId || !field) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

    const updateData: any = {};
    if (field === "completed") updateData.completed = value;
    if (field === "creatineTaken") updateData.creatineTaken = value;

    const updated = await prisma.dailyWorkout.update({
      where: { id: workoutId },
      data: updateData
    });

    revalidatePath('/routine/week');
    revalidatePath('/metrics');
    
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
