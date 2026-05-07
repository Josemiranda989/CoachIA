import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { GymWorkoutClient } from "./GymWorkoutClient";
import { CyclingWorkoutClient } from "./CyclingWorkoutClient";
import { BackLink } from "@/components/BackLink";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCurrentWeekStart } from "@/lib/week";

export const metadata: Metadata = { title: "Entrenamiento de hoy" };

export default async function TodayWorkoutPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const userId = session.user.id;
  const weekStart = getCurrentWeekStart();

  // First, try to find a routine for the current week or past weeks
  let routine = await prisma.routine.findFirst({
    where: {
      userId,
      status: "active",
      weekStart: { lte: weekStart },
    },
    orderBy: { weekStart: 'desc' },
    include: {
      days: {
        include: {
          exercises: { include: { logs: { where: { weekStart } } } },
          completions: { where: { weekStart } },
          blocks: { orderBy: { order: 'asc' } },
        }
      }
    }
  });

  // If no routine for current/past weeks, look for upcoming ones
  // (e.g. after approving a monthly mesocycle that starts next week)
  if (!routine) {
    routine = await prisma.routine.findFirst({
      where: {
        userId,
        status: "active",
        weekStart: { gt: weekStart },
      },
      orderBy: { weekStart: 'asc' },
      include: {
        days: {
          include: {
            exercises: { include: { logs: { where: { weekStart } } } },
            completions: { where: { weekStart } },
            blocks: { orderBy: { order: 'asc' } },
          }
        }
      }
    });
  }

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

  // Prefill last weight from the most recent PAST week (not current) for each exercise name.
  // Single query scoped to the current user (prevents reading other users' logs that share an exercise name).
  const exerciseNames = todayWorkout.exercises.map((ex: any) => ex.name);
  const pastLogs = exerciseNames.length === 0 ? [] : await prisma.workoutLog.findMany({
    where: {
      exercise: {
        name: { in: exerciseNames },
        dailyWorkout: { routine: { userId } },
      },
      weekStart: { lt: weekStart },
    },
    orderBy: [{ weekStart: 'desc' }, { id: 'desc' }],
    select: { weight: true, exercise: { select: { name: true } } },
  });

  const lastWeightByName = new Map<string, number>();
  for (const log of pastLogs) {
    if (!lastWeightByName.has(log.exercise.name)) {
      lastWeightByName.set(log.exercise.name, log.weight);
    }
  }

  const exercisesWithLastWeight = todayWorkout.exercises.map((ex: any) => ({
    ...ex,
    lastWeight: lastWeightByName.get(ex.name) ?? "",
  }));

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
