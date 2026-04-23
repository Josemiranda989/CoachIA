import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/exercises — list all exercise definitions (alphabetical). Public read.
export async function GET() {
  const exercises = await prisma.exerciseDefinition.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      muscleGroups: true,
      equipment: true,
      imagePath: true,
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ count: exercises.length, exercises });
}
