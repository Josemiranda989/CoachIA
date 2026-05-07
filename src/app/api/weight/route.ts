import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";

export async function POST(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { weight, bodyFat, muscle, notes, date, scaleId } = body;

  if (!weight || typeof weight !== "number" || weight <= 0) {
    return NextResponse.json(
      { error: "weight is required and must be a positive number (kg)" },
      { status: 400 }
    );
  }

  const dateObj = date ? new Date(date) : new Date();

  const existing = await prisma.bodyWeight.findUnique({
    where: { userId_date: { userId: auth.userId, date: dateObj } },
  });

  if (existing) {
    const updated = await prisma.bodyWeight.update({
      where: { id: existing.id },
      data: {
        weight,
        bodyFat: bodyFat ?? existing.bodyFat,
        muscle: muscle ?? existing.muscle,
        scaleId: scaleId ?? existing.scaleId,
        notes: notes ?? existing.notes,
      },
    });
    return NextResponse.json(updated, { status: 200 });
  }

  const record = await prisma.bodyWeight.create({
    data: {
      userId: auth.userId,
      date: dateObj,
      weight,
      bodyFat: bodyFat ?? null,
      muscle: muscle ?? null,
      scaleId: scaleId ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(record, { status: 201 });
}

export async function GET(request: Request) {
  const auth = await resolveAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "30");

  const records = await prisma.bodyWeight.findMany({
    where: { userId: auth.userId },
    orderBy: { date: "desc" },
    take: limit,
  });

  return NextResponse.json(records);
}
