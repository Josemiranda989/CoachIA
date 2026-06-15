import { prisma } from "@/lib/prisma";

const HEVY_API_BASE = "https://api.hevyapp.com/v1";
const TITLE_PREFIX = "🗄️ OLD - ";
const REQUEST_DELAY_MS = 4000;

export interface HevyArchiveResult {
  hevyRoutineId: string;
  renamed: boolean;
  reason?: string;
  error?: string;
}

interface HevyRoutineResponse {
  routine?: {
    id?: string;
    title?: string;
    notes?: string;
    exercises?: Array<{
      exercise_template_id: string;
      rest_seconds?: number;
      notes?: string;
      sets?: Array<{ type?: string; weight_kg?: number | null; reps?: number | null }>;
    }>;
  };
}

async function renameInHevy(apiKey: string, hevyRoutineId: string): Promise<HevyArchiveResult> {
  const getRes = await fetch(`${HEVY_API_BASE}/routines/${hevyRoutineId}`, {
    headers: { "api-key": apiKey },
  });
  if (!getRes.ok) {
    return { hevyRoutineId, renamed: false, reason: "fetch-failed", error: `${getRes.status}` };
  }
  const data = (await getRes.json()) as HevyRoutineResponse;
  const routine = data.routine;
  if (!routine || !routine.title) {
    return { hevyRoutineId, renamed: false, reason: "no-routine-data" };
  }
  if (routine.title.startsWith(TITLE_PREFIX)) {
    return { hevyRoutineId, renamed: false, reason: "already-archived" };
  }

  const exercises = (routine.exercises || []).map((ex) => ({
    exercise_template_id: ex.exercise_template_id,
    rest_seconds: ex.rest_seconds ?? 60,
    notes: ex.notes && ex.notes.trim() ? ex.notes : "-",
    sets: (ex.sets || []).map((s) => ({
      type: s.type || "normal",
      weight_kg: s.weight_kg,
      reps: s.reps,
    })),
  }));

  const payload = {
    routine: {
      title: TITLE_PREFIX + routine.title,
      notes: routine.notes && routine.notes.trim() ? routine.notes : "Archivado por CoachIA",
      exercises,
    },
  };

  const putRes = await fetch(`${HEVY_API_BASE}/routines/${hevyRoutineId}`, {
    method: "PUT",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!putRes.ok) {
    const body = await putRes.text();
    return { hevyRoutineId, renamed: false, reason: "put-failed", error: `${putRes.status}: ${body.slice(0, 200)}` };
  }
  return { hevyRoutineId, renamed: true };
}

// Renames Hevy routines linked to the given internal routineIds with a "🗄️ OLD - "
// prefix. Best-effort: failures are returned, never throw. Serial pacing to respect
// Hevy's ~15-20 req/min rate limit. Returns when all attempts finish.
export async function archiveRoutinesInHevy(routineIds: string[]): Promise<HevyArchiveResult[]> {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey || routineIds.length === 0) return [];

  const dws = await prisma.dailyWorkout.findMany({
    where: { routineId: { in: routineIds }, hevyRoutineId: { not: null } },
    select: { hevyRoutineId: true },
  });
  const ids = Array.from(new Set(dws.map((d) => d.hevyRoutineId!).filter(Boolean)));

  const results: HevyArchiveResult[] = [];
  for (const id of ids) {
    try {
      const r = await renameInHevy(apiKey, id);
      results.push(r);
    } catch (e: unknown) {
      results.push({
        hevyRoutineId: id,
        renamed: false,
        reason: "exception",
        error: e instanceof Error ? e.message : String(e),
      });
    }
    await new Promise((res) => setTimeout(res, REQUEST_DELAY_MS));
  }
  return results;
}
