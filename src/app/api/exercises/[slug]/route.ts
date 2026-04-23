import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const exercise = await prisma.exerciseDefinition.findUnique({ where: { slug } });
  if (!exercise) {
    return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
  }
  return NextResponse.json(exercise);
}
