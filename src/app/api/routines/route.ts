import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma'; 

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Basic validation
    if (!data.weekStart || !Array.isArray(data.days)) {
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }

    // Nested create
    const routine = await prisma.routine.create({
      data: {
        weekStart: new Date(data.weekStart),
        days: {
          create: data.days.map((day: any) => ({
            dayOfWeek: day.dayOfWeek,
            type: day.type,
            targetDuration: day.targetDuration || null,
            targetPower: day.targetPower || day.targetIntensity || null,
            notes: day.notes || null,
            exercises: day.exercises && day.exercises.length > 0 ? {
              create: day.exercises.map((ex: any) => ({
                name: ex.name,
                targetSets: ex.targetSets,
                targetReps: ex.targetReps || null
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
