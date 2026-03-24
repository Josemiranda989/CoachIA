export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { DayCardClient } from "./DayCardClient";

export default async function WeeklyRoutinePage() {
  const routine = await prisma.routine.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      days: {
        include: { exercises: true }
      }
    }
  });

  if (!routine) {
    return (
      <div className="container">
        <h1 className="title">Rutina de la Semana</h1>
        <p className="subtitle">No tienes ninguna rutina cargada actualmente.</p>
        <Link href="/routine/load" className="btn" style={{display: "inline-block"}}>Cargar Rutina</Link>
      </div>
    );
  }

  // Ordenar días de la semana de Lunes a Domingo
  const order = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
  
  const sortedDays = [...routine.days].sort((a, b) => {
    return (order[a.dayOfWeek as keyof typeof order] || 8) - (order[b.dayOfWeek as keyof typeof order] || 8);
  });

  return (
    <div className="container" style={{ paddingBottom: "60px" }}>
      <Link href="/" style={{ color: "var(--text-secondary)", display: "inline-block", marginBottom: "16px" }}>
        &larr; Volver
      </Link>
      <h1 className="title">Tu Semana en un Vistazo 🗓️</h1>
      <p className="subtitle">Vista general de tu planificación actual</p>

      {sortedDays.map((day) => (
        <DayCardClient key={day.id} day={day} />
      ))}
    </div>
  );
}
