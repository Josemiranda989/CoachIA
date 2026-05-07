import type { Metadata } from "next";
import Link from "next/link";
import { DayCardClient } from "./DayCardClient";
import { BackLink } from "@/components/BackLink";
import { ExportCyclingButton } from "@/components/ExportCyclingButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentWeekStart } from "@/lib/week";
import { getActiveRoutineWithBlocks } from "@/lib/queries/getActiveRoutine";

export const metadata: Metadata = { title: "Rutina semanal" };

export default async function WeeklyRoutinePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const weekStart = getCurrentWeekStart();
  const routine = await getActiveRoutineWithBlocks(session.user.id, weekStart);

  if (!routine) {
    return (
      <div className="container py-8">
        <h1 className="title">Rutina de la Semana</h1>
        <p className="subtitle">No tienes ninguna rutina cargada actualmente.</p>
        <Link href="/routine/load" className="btn inline-block">Cargar Rutina</Link>
      </div>
    );
  }

  const order = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };

  const sortedDays = [...routine.days].sort((a, b) => {
    return (order[a.dayOfWeek as keyof typeof order] || 8) - (order[b.dayOfWeek as keyof typeof order] || 8);
  });

  const daysForClient = sortedDays.map((d) => ({
    ...d,
    completed: d.completions[0]?.completed ?? false,
    creatineTaken: d.completions[0]?.creatineTaken ?? false,
  }));

  const cyclingCount = routine.days.filter(
    (d) => d.targetDuration != null && d.blocks?.length > 0
  ).length;

  return (
    <div className="container py-8 pb-16">
      <BackLink href="/" />
      <h1 className="title">Tu Semana en un Vistazo</h1>
      <p className="subtitle">Vista general de tu planificación actual</p>

      {daysForClient.map((day) => (
        <DayCardClient key={day.id} day={day} />
      ))}

      {cyclingCount > 0 && (
        <div className="mt-8">
          <ExportCyclingButton cyclingCount={cyclingCount} />
        </div>
      )}
    </div>
  );
}
