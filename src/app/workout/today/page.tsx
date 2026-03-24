export const dynamic = 'force-dynamic';
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { GymWorkoutClient } from "./GymWorkoutClient";
import { CyclingWorkoutClient } from "./CyclingWorkoutClient";

export default async function TodayWorkoutPage() {
  const routine = await prisma.routine.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      days: {
        include: { exercises: { include: { logs: true } } }
      }
    }
  });

  if (!routine) {
    return (
      <div className="container">
        <h1 className="title">Día de Hoy</h1>
        <p className="subtitle">No tienes ninguna rutina cargada.</p>
        <Link href="/routine/load" className="btn" style={{display: "inline-block"}}>Cargar Rutina</Link>
      </div>
    );
  }

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = daysOfWeek[new Date().getDay()];

  const todayWorkout = routine.days.find(d => d.dayOfWeek === todayName) || routine.days.find(d => d.dayOfWeek === "Monday"); 
  // Fallback to Monday for demonstration purposes if today finds nothing, useful for the user checking the app.

  if (!todayWorkout || todayWorkout.type.includes("Rest")) {
    return (
      <div className="container">
        <h1 className="title">Día de Hoy ({todayName})</h1>
        <p className="subtitle">Día de descanso. ¡Recupera energías!</p>
        {todayWorkout?.notes && (
          <div className="card" style={{marginTop: "16px", backgroundColor: "var(--bg-card)"}}>
            <p style={{ color: "var(--text-secondary)" }}>{todayWorkout.notes}</p>
          </div>
        )}
        <Link href="/" className="btn btn-secondary" style={{marginTop: "24px", display: "inline-block"}}>&larr; Volver</Link>
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
    <div className="container" style={{ paddingBottom: "60px" }}>
      <Link href="/" style={{ color: "var(--text-secondary)", display: "inline-block", marginBottom: "16px" }}>
        &larr; Volver
      </Link>
      <h1 className="title">{title}</h1>
      <p className="subtitle">Rutina del {todayWorkout.dayOfWeek}</p>

      {todayWorkout.notes && (
        <div className="card" style={{ marginBottom: "24px", backgroundColor: "var(--bg-card)", padding: "16px" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>📝 {todayWorkout.notes}</p>
        </div>
      )}

      {isGym && (
        <div style={{ marginBottom: "32px" }}>
          {isCycling && <h2 style={{ fontSize: "20px", marginBottom: "16px", color: "var(--text-primary)" }}>1. Sesión de Gym</h2>}
          <GymWorkoutClient workout={workoutWithLastWeights} />
        </div>
      )}

      {isCycling && (
        <div>
          {isGym && <h2 style={{ fontSize: "20px", marginBottom: "16px", color: "var(--text-primary)", marginTop: "16px" }}>2. Sesión de Bici</h2>}
          <CyclingWorkoutClient workout={todayWorkout} />
        </div>
      )}
    </div>
  );
}
