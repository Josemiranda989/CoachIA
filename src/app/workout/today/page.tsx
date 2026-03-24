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

  if (!todayWorkout || todayWorkout.type.includes("Rest")) {
    return (
      <div className="container py-8">
        <h1 className="title">Día de Hoy ({todayName})</h1>
        <p className="subtitle">Día de descanso. ¡Recupera energías!</p>
        {todayWorkout?.notes && (
          <div className="card mt-4 bg-bg-card">
            <p className="text-text-secondary">{todayWorkout.notes}</p>
          </div>
        )}
        <Link href="/" className="btn btn-secondary mt-6 inline-block">&larr; Volver</Link>
      </div>
    );
  }

  const isGym = todayWorkout.type.includes("Gym");
  const isCycling = todayWorkout.type.includes("Cycling");

  let title = "Entrenamiento";
  if (isGym && isCycling) title = "Gym + Bici 🏋️‍♂️🚴‍♂️";
  else if (isGym) title = "Entrenamiento Gym 🏋️‍♂️";
  else if (isCycling) title = "Entrenamiento Bici 🚴‍♂️";

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
    <div className="container py-8 pb-16">
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
