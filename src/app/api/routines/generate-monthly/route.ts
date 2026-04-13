import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { sendTelegramMessage } from "@/lib/telegram";

function getNextMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday.toISOString();
}

// POST: Save a generated routine (called by Claude Code scheduled task or n8n)
export async function POST(request: Request) {
  try {
    const auth = await resolveAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { routine } = body;

    if (!routine || !routine.days || !Array.isArray(routine.days)) {
      return NextResponse.json(
        { error: "Body must contain { routine: { weekStart, days: [...] } }" },
        { status: 400 }
      );
    }

    const weekStart = routine.weekStart || getNextMonday();

    // Validate days structure
    for (const day of routine.days) {
      if (!day.dayOfWeek || !day.type) {
        return NextResponse.json(
          { error: "Each day must have dayOfWeek and type" },
          { status: 400 }
        );
      }
    }

    // Archive any existing pending_approval routines (only one allowed at a time)
    await prisma.routine.updateMany({
      where: { userId: auth.userId, status: "pending_approval" },
      data: { status: "archived" },
    });

    // Save to DB with pending_approval status
    const saved = await prisma.routine.create({
      data: {
        userId: auth.userId,
        weekStart: new Date(weekStart),
        status: "pending_approval",
        days: {
          create: routine.days.map((day: any) => ({
            dayOfWeek: day.dayOfWeek,
            type: day.type,
            targetDuration: day.targetDuration ?? null,
            targetPower: day.targetPower ?? null,
            notes: day.notes ?? null,
            exercises: {
              create: (day.exercises ?? []).map((ex: any) => ({
                name: ex.name,
                targetSets: ex.targetSets,
                targetReps: ex.targetReps ?? null,
              })),
            },
          })),
        },
      },
      include: {
        days: { include: { exercises: true } },
      },
    });

    // Send Telegram notification
    const dayNames: Record<string, string> = {
      Monday: "Lunes", Tuesday: "Martes", Wednesday: "Miercoles",
      Thursday: "Jueves", Friday: "Viernes", Saturday: "Sabado", Sunday: "Domingo",
    };

    const summary = saved.days
      .map((d) => {
        const dayName = dayNames[d.dayOfWeek] ?? d.dayOfWeek;
        const exercises = d.exercises.length > 0
          ? d.exercises.map((e) => `  - ${e.name} ${e.targetSets}x${e.targetReps}`).join("\n")
          : "";
        const bike = d.targetDuration ? `  Bici: ${d.targetDuration}min ${d.targetPower ?? ""}` : "";
        return `<b>${dayName}</b> (${d.type})\n${exercises}${bike}`;
      })
      .join("\n\n");

    await sendTelegramMessage(
      `Nueva rutina generada por IA!\n\nComienza: ${new Date(weekStart).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}\n\n${summary}\n\nAproba o rechazala en CoachIA.`
    );

    return NextResponse.json({
      routine: saved,
      message: "Rutina guardada. Pendiente de aprobación.",
    });
  } catch (err: any) {
    console.error("Save routine error:", err);
    return NextResponse.json(
      { error: "Error al guardar rutina", details: err.message },
      { status: 500 }
    );
  }
}
