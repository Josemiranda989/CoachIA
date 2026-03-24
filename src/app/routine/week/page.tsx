import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { DayCardClient } from "./DayCardClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function WeeklyRoutinePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const routine = await prisma.routine.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      days: {
        include: { exercises: true }
      }
    }
  });

  if (!routine) {
    return (
      <div className="container py-8">
        <h1 className="title">Rutina de la Semana</h1>
        <p className="subtitle">No tienes ninguna rutina cargada actualmente.</p>
        <Link href="/routine/load" className="btn inline-block">Cargar Rutina</Link>
      </div>
    );
  }

  // Ordenar días de la semana de Lunes a Domingo
  const order = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
  
  const sortedDays = [...routine.days].sort((a, b) => {
    return (order[a.dayOfWeek as keyof typeof order] || 8) - (order[b.dayOfWeek as keyof typeof order] || 8);
  });

  return (
    <div className="container py-8 pb-16">
      <Link href="/" className="text-text-secondary inline-block mb-4 hover:text-text-primary transition-colors">
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
