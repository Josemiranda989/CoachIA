import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { GymWorkoutClient } from "./GymWorkoutClient";
import { CyclingWorkoutClient } from "./CyclingWorkoutClient";
import { BackLink } from "@/components/BackLink";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentWeekStart } from "@/lib/week";

export default async function TodayWorkoutPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const weekStart = getCurrentWeekStart();

  const routine = await prisma.routine.findFirst({
    where: {
      userId: (session as any).user.id,
      status: "active",
      weekStart: { lte: weekStart },
    },
    orderBy: { weekStart: 'desc' },
    include: {
      days: {
        include: {
          exercises: { include: { logs: true } },
          completions: { where: { weekStart } },
          blocks: { orderBy: { order: 'asc' } },
        }
      }
    }
  });

  if (!routine) {
    return (
      <div className="container py-8">
        <h1 className="title">Día de Hoy</h1>
        <p className="subtitle">No tienes ninguna rutina cargada.</p>
        <Link href="/routine/load" className="btn inline-block">Cargar Rutina</Link>
      </div>
    );
  }

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const daysInSpanish: Record<string, string> = {
    Sunday: "Domingo", Monday: "Lunes", Tuesday: "Martes", Wednesday: "Miércoles",
    Thursday: "Jueves", Friday: "Viernes", Saturday: "Sábado",
  };
  const todayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Tucuman',
    weekday: 'long',
  }).format(new Date());

  const todayWorkout = routine.days.find(d => d.dayOfWeek === todayName) || routine.days.find(d => d.dayOfWeek === "Monday"); 
  // Fallback to Monday for demonstration purposes if today finds nothing, useful for the user checking the app.

  // Inferir comportamiento por datos, no por el texto del tipo
  const hasExercises = (todayWorkout?.exercises?.length ?? 0) > 0;
  const hasCyclingData = !!(todayWorkout?.targetDuration);
  const isRestLike = !todayWorkout || (!hasExercises && !hasCyclingData);

  if (isRestLike) {
    return (
      <div className="app-container py-8">
        <BackLink href="/" />
        <h1 className="title">{todayWorkout?.type ?? "Descanso"}</h1>
        {todayWorkout?.targetDuration && (
          <p className="subtitle">{todayWorkout.targetDuration} min — {todayWorkout.targetPower}</p>
        )}
        {todayWorkout?.notes && (
          <div className="card mt-4">
            <p className="text-text-secondary">📝 {todayWorkout.notes}</p>
          </div>
        )}
      </div>
    );
  }

  const isGym = hasExercises;
  const isCycling = hasCyclingData;

  let title = todayWorkout.type;
  if (isGym && isCycling) title = `${todayWorkout.type} 🏋️‍♂️🚴‍♂️`;
  else if (isGym) title = `${todayWorkout.type} 🏋️‍♂️`;
  else if (isCycling) title = `${todayWorkout.type} 🚴‍♂️`;

  // Fetch last weight for each exercise (looks at exercises whose day was ever completed)
  const exercisesWithLastWeight = await Promise.all(
    todayWorkout.exercises.map(async (ex: any) => {
      const lastLog = await prisma.workoutLog.findFirst({
        where: {
          exercise: {
            name: ex.name,
            dailyWorkout: { completions: { some: { completed: true } } },
          },
        },
        orderBy: { id: 'desc' },
      });
      return { ...ex, lastWeight: lastLog?.weight || "" };
    })
  );

  const todayCompletion = todayWorkout.completions[0];
  const workoutWithLastWeights = {
    ...todayWorkout,
    exercises: exercisesWithLastWeight,
    completed: todayCompletion?.completed ?? false,
  };
  const cyclingWorkout = { ...todayWorkout, completed: todayCompletion?.completed ?? false };

  return (
    <div className="px-4 py-6 md:px-6 md:py-8 pb-16" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <BackLink href="/" />
      <h1 className="title">{title}</h1>
      <p className="subtitle">Rutina del {daysInSpanish[todayWorkout.dayOfWeek] || todayWorkout.dayOfWeek}</p>

      {todayWorkout.notes && (
        <div className="card mb-6 p-4 bg-bg-card">
          <p className="text-text-secondary text-sm">📝 {todayWorkout.notes}</p>
        </div>
      )}

      {isGym && (
        <div className="mb-8">
          {isCycling && <h2 className="text-xl mb-4 text-text-primary">1. Sesión de Gym</h2>}
          <GymWorkoutClient workout={workoutWithLastWeights} />
        </div>
      )}

      {isCycling && (
        <div>
          {isGym && <h2 className="text-xl mb-4 text-text-primary mt-4">2. Sesión de Bici</h2>}
          <CyclingWorkoutClient workout={cyclingWorkout} />
        </div>
      )}
    </div>
  );
}
