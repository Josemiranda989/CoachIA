import { prisma } from "@/lib/prisma";

const HEVY_API_BASE = "https://api.hevyapp.com/v1";
const DEFAULT_REST_SECONDS = 120;

interface HevySet {
  type: "warmup" | "normal" | "failure" | "dropset";
  weight_kg?: number;
  reps: number | null;
}

interface HevyExercise {
  exercise_template_id: string;
  rest_seconds: number;
  notes?: string;
  sets: HevySet[];
}

interface HevyRoutinePayload {
  routine: {
    title: string;
    folder_id: null;
    notes: string;
    exercises: HevyExercise[];
  };
}

export interface SyncResult {
  dayOfWeek: string;
  action: "created" | "updated" | "skipped";
  reason?: string;
  hevyRoutineId?: string;
  exercisesSent?: number;
  unmapped?: string[];
  error?: string;
}

function parseReps(reps: string | null | undefined): number | null {
  if (!reps) return null;
  const match = reps.match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
  if (!match) return null;
  return parseInt(match[2] || match[1]);
}

const daysInSpanish: Record<string, string> = {
  Sunday: "Domingo",
  Monday: "Lunes",
  Tuesday: "Martes",
  Wednesday: "Miercoles",
  Thursday: "Jueves",
  Friday: "Viernes",
  Saturday: "Sabado",
};

export async function syncDailyWorkoutToHevy(
  dailyWorkoutId: string,
  weekStart: string
): Promise<SyncResult> {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) {
    return {
      dayOfWeek: "?",
      action: "skipped",
      reason: "HEVY_API_KEY not configured",
    };
  }

  const dw = await prisma.dailyWorkout.findUnique({
    where: { id: dailyWorkoutId },
    include: { exercises: true, routine: true },
  });
  if (!dw) return { dayOfWeek: "?", action: "skipped", reason: "DailyWorkout not found" };
  if (dw.type !== "Gym")
    return { dayOfWeek: dw.dayOfWeek, action: "skipped", reason: "not gym" };
  if (!dw.exercises.length)
    return { dayOfWeek: dw.dayOfWeek, action: "skipped", reason: "no exercises" };

  // Hybrid resolution: prefer direct Exercise.hevyTemplateId (set when Gemini
  // picks from the Hevy pool). Fall back to the legacy HevyExerciseMapping
  // keyed by canonical Spanish name for routines created before this change.
  const needsFallback = dw.exercises.filter((e) => !e.hevyTemplateId).map((e) => e.name);
  const mappings = needsFallback.length
    ? await prisma.hevyExerciseMapping.findMany({
        where: { coachiaName: { in: needsFallback } },
      })
    : [];
  const mappingByName = new Map(mappings.map((m) => [m.coachiaName, m]));

  const hevyExercises: HevyExercise[] = [];
  const unmapped: string[] = [];

  for (const ex of dw.exercises) {
    const templateId = ex.hevyTemplateId ?? mappingByName.get(ex.name)?.hevyTemplateId;
    if (!templateId) {
      unmapped.push(ex.name);
      continue;
    }
    const lastLog = await prisma.workoutLog.findFirst({
      where: { exercise: { name: ex.name }, weekStart: { lt: weekStart } },
      orderBy: [{ weekStart: "desc" }, { id: "desc" }],
    });

    const reps = parseReps(ex.targetReps);
    const sets: HevySet[] = Array.from({ length: ex.targetSets }).map(() => ({
      type: "normal" as const,
      weight_kg: lastLog?.weight ?? undefined,
      reps,
    }));

    hevyExercises.push({
      exercise_template_id: templateId,
      rest_seconds: DEFAULT_REST_SECONDS,
      sets,
    });
  }

  if (hevyExercises.length === 0) {
    return {
      dayOfWeek: dw.dayOfWeek,
      action: "skipped",
      reason: "no mapped exercises",
      unmapped,
    };
  }

  const dayLabel = daysInSpanish[dw.dayOfWeek] ?? dw.dayOfWeek;
  const payload: HevyRoutinePayload = {
    routine: {
      title: `CoachIA - ${dayLabel} (${dw.routine.weekStart})`,
      folder_id: null,
      notes: "Sincronizado desde CoachIA",
      exercises: hevyExercises,
    },
  };

  try {
    if (dw.hevyRoutineId) {
      const res = await fetch(`${HEVY_API_BASE}/routines/${dw.hevyRoutineId}`, {
        method: "PUT",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`PUT ${res.status}: ${errBody.slice(0, 200)}`);
      }
      return {
        dayOfWeek: dw.dayOfWeek,
        action: "updated",
        hevyRoutineId: dw.hevyRoutineId,
        exercisesSent: hevyExercises.length,
        unmapped: unmapped.length ? unmapped : undefined,
      };
    }

    const res = await fetch(`${HEVY_API_BASE}/routines`, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`POST ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = (await res.json()) as { routine?: unknown; id?: string };
    const routineData = Array.isArray(data.routine)
      ? data.routine[0]
      : (data.routine as { id?: string } | undefined) ?? data;
    const newId = (routineData as { id?: string })?.id;
    if (!newId)
      throw new Error(`Hevy response has no id: ${JSON.stringify(data).slice(0, 200)}`);

    await prisma.dailyWorkout.update({
      where: { id: dailyWorkoutId },
      data: { hevyRoutineId: newId },
    });

    return {
      dayOfWeek: dw.dayOfWeek,
      action: "created",
      hevyRoutineId: newId,
      exercisesSent: hevyExercises.length,
      unmapped: unmapped.length ? unmapped : undefined,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { dayOfWeek: dw.dayOfWeek, action: "skipped", reason: "hevy-error", error: msg };
  }
}

export async function syncRoutineToHevy(routineId: string): Promise<SyncResult[]> {
  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    include: { days: true },
  });
  if (!routine) return [];

  const gymDays = routine.days.filter((d) => d.type === "Gym");
  return Promise.all(gymDays.map((d) => syncDailyWorkoutToHevy(d.id, routine.weekStart)));
}
