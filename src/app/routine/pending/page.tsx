import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PendingRoutineActions } from "./PendingRoutineActions";
import { BackLink } from "@/components/BackLink";
import { CyclingBlocks } from "@/components/CyclingBlocks";

const dayOrder: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const dayNames: Record<string, string> = {
  Monday: "Lunes",
  Tuesday: "Martes",
  Wednesday: "Miércoles",
  Thursday: "Jueves",
  Friday: "Viernes",
  Saturday: "Sábado",
  Sunday: "Domingo",
};

const typeColors: Record<string, string> = {
  Gym: "text-accent-gym",
  Cycling: "text-accent-cycling",
  "Gym + Cycling": "text-accent-primary",
  Rest: "text-text-secondary",
};

export default async function PendingRoutinePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const userId = session.user.id;

  const routines = await prisma.routine.findMany({
    where: { userId, status: "pending_approval" },
    orderBy: { weekStart: "asc" },
    include: {
      days: {
        include: {
          exercises: true,
          blocks: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (routines.length === 0) {
    return (
      <div className="app-container py-10">
        <Link
          href="/"
          className="text-text-secondary inline-block mb-4 hover:text-text-primary transition-colors"
        >
          &larr; Volver
        </Link>
        <h1 className="title">Rutina Pendiente</h1>
        <p className="subtitle">No hay rutinas pendientes de aprobación.</p>
      </div>
    );
  }

  const firstWeek = routines[0].weekStart;
  const lastWeek = routines[routines.length - 1].weekStart;

  return (
    <div className="app-container py-10 pb-32">
      <BackLink href="/" />

      <div className="flex items-center gap-3 mb-2">
        <span className="bg-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
          Pendiente de aprobación
        </span>
      </div>

      <h1 className="title text-3xl mb-1">
        {routines.length === 1
          ? "Nueva Rutina Generada por IA"
          : `Mesociclo de ${routines.length} Semanas`}
      </h1>
      <p className="subtitle mb-8">
        {routines.length === 1
          ? `Comienza el ${new Date(firstWeek + "T00:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}`
          : `Desde el ${new Date(firstWeek + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" })} hasta la semana del ${new Date(lastWeek + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" })}`}
      </p>

      <div className="space-y-8 mb-8">
        {routines.map((routine, idx) => {
          const sortedDays = [...routine.days].sort(
            (a, b) =>
              (dayOrder[a.dayOfWeek] ?? 8) - (dayOrder[b.dayOfWeek] ?? 8)
          );

          return (
            <section key={routine.id}>
              {routines.length > 1 && (
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-xl font-bold text-accent-primary">
                    Semana {idx + 1} de {routines.length}
                  </h2>
                  <span className="text-sm text-text-secondary">
                    desde{" "}
                    {new Date(routine.weekStart + "T00:00:00").toLocaleDateString(
                      "es-AR",
                      { weekday: "long", day: "numeric", month: "long" }
                    )}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {sortedDays.map((day) => (
                  <div key={day.id} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold">
                        {dayNames[day.dayOfWeek] ?? day.dayOfWeek}
                      </h3>
                      <span
                        className={`text-sm font-semibold ${typeColors[day.type] ?? "text-text-secondary"}`}
                      >
                        {day.type}
                      </span>
                    </div>

                    {day.exercises.length > 0 && (
                      <div className="space-y-2">
                        {day.exercises.map((ex) => (
                          <div
                            key={ex.id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="text-text-primary min-w-0 truncate">
                              {ex.name}
                            </span>
                            <span className="text-text-secondary shrink-0">
                              {ex.targetSets} x {ex.targetReps}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {day.targetDuration && (
                      <div className="mt-2">
                        <div className="text-sm text-accent-cycling">
                          Bici: {day.targetDuration} min
                          {day.targetPower && ` — ${day.targetPower}`}
                        </div>
                        <CyclingBlocks
                          blocks={(day as any).blocks}
                          variant="detailed"
                          fallbackDuration={null}
                          fallbackPower={null}
                        />
                      </div>
                    )}

                    {day.notes && (
                      <p className="mt-2 text-xs text-text-secondary italic">
                        {day.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <PendingRoutineActions count={routines.length} />
    </div>
  );
}
