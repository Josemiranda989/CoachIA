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

const dayOrder: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

// Short focus tag for the Hevy title, derived from the day's notes.
// "Empuje/jalón, sin piernas" -> "Empuje/jalón"; "Leg day" -> "Leg day".
function focusLabel(notes: string | null | undefined): string {
  if (!notes) return "";
  const first = notes.split(",")[0].trim();
  return first.length > 28 ? first.slice(0, 28).trim() : first;
}

export async function syncDailyWorkoutToHevy(
  dailyWorkoutId: string,
  weekStart: string,
  slotIndex: number
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

  const focus = focusLabel(dw.notes);
  const payload: HevyRoutinePayload = {
    routine: {
      title: focus ? `CoachIA - Día ${slotIndex} (${focus})` : `CoachIA - Día ${slotIndex}`,
      folder_id: null,
      notes: "Sincronizado desde CoachIA",
      exercises: hevyExercises,
    },
  };

  const userId = dw.routine.userId;

  // Stable identity: each gym slot (Día N) reuses ONE Hevy routine across all 4
  // weeks of the mesocycle AND across mesocycles. Prefer the persisted slot id;
  // fall back to this workout's own id (rows synced before slots existed).
  const slot = await prisma.hevyGymSlot.findUnique({
    where: { userId_slotIndex: { userId, slotIndex } },
  });
  const targetHevyId = slot?.hevyRoutineId ?? dw.hevyRoutineId ?? null;

  // Persist the slot mapping and mirror the id onto this DailyWorkout so the
  // 3 routines stay reused instead of accumulating one per week/mesocycle.
  async function persistSlot(hevyRoutineId: string): Promise<void> {
    await prisma.hevyGymSlot.upsert({
      where: { userId_slotIndex: { userId, slotIndex } },
      create: { userId, slotIndex, hevyRoutineId },
      update: { hevyRoutineId },
    });
    if (dw!.hevyRoutineId !== hevyRoutineId) {
      await prisma.dailyWorkout.update({
        where: { id: dailyWorkoutId },
        data: { hevyRoutineId },
      });
    }
  }

  try {
    if (targetHevyId) {
      const res = await fetch(`${HEVY_API_BASE}/routines/${targetHevyId}`, {
        method: "PUT",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await persistSlot(targetHevyId);
        return {
          dayOfWeek: dw.dayOfWeek,
          action: "updated",
          hevyRoutineId: targetHevyId,
          exercisesSent: hevyExercises.length,
          unmapped: unmapped.length ? unmapped : undefined,
        };
      }
      // 404 → routine was deleted in Hevy; fall through and recreate it (self-healing).
      if (res.status !== 404) {
        const errBody = await res.text();
        throw new Error(`PUT ${res.status}: ${errBody.slice(0, 200)}`);
      }
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

    await persistSlot(newId);

    return {
      dayOfWeek: dw.dayOfWeek,
      action: targetHevyId ? "updated" : "created",
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

  // Sort gym days chronologically so the slot index is stable: Día 1 = first gym
  // day of the week, Día 2 = second, etc. This is what ties every week's "Día N"
  // to the same persistent Hevy routine.
  const gymDays = routine.days
    .filter((d) => d.type === "Gym")
    .sort((a, b) => (dayOrder[a.dayOfWeek] ?? 99) - (dayOrder[b.dayOfWeek] ?? 99));

  return Promise.all(
    gymDays.map((d, i) => syncDailyWorkoutToHevy(d.id, routine.weekStart, i + 1))
  );
}
