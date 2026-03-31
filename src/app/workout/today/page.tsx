import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { GymWorkoutClient } from "./GymWorkoutClient";
import { CyclingWorkoutClient } from "./CyclingWorkoutClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TodayWorkoutPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const routine = await prisma.routine.findFirst({
    where: { userId: (session as any).user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      days: {
        include: { exercises: { include: { logs: true } } }
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
  const todayName = daysOfWeek[new Date().getDay()];

  const todayWorkout = routine.days.find(d => d.dayOfWeek === todayName) || routine.days.find(d => d.dayOfWeek === "Monday"); 
  // Fallback to Monday for demonstration purposes if today finds nothing, useful for the user checking the app.

  // Inferir comportamiento por datos, no por el texto del tipo
  const hasExercises = (todayWorkout?.exercises?.length ?? 0) > 0;
  const hasCyclingData = !!(todayWorkout?.targetDuration);
  const isRestLike = !todayWorkout || (!hasExercises && !hasCyclingData);

  if (isRestLike) {
    return (
      <div className="app-container py-8">
        <Link href="/" className="back-btn">&larr; Volver</Link>
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

  // Fetch last weight for each exercise
  const exercisesWithLastWeight = await Promise.all(
    todayWorkout.exercises.map(async (ex: any) => {
      const lastLog = await prisma.workoutLog.findFirst({
        where: { 
          exercise: { 
            name: ex.name,
            dailyWorkout: { completed: true }
          }
        },
        orderBy: { id: 'desc' }, 
      });
      return { ...ex, lastWeight: lastLog?.weight || "" };
    })
  );

  const workoutWithLastWeights = { ...todayWorkout, exercises: exercisesWithLastWeight };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 64px" }}>
      <Link href="/" className="text-text-secondary inline-block mb-4 hover:text-text-primary transition-colors">
        &larr; Volver
      </Link>
      <h1 className="title">{title}</h1>
      <p className="subtitle">Rutina del {todayWorkout.dayOfWeek}</p>

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
          <CyclingWorkoutClient workout={todayWorkout} />
        </div>
      )}
    </div>
  );
}
