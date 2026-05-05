import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { getCurrentWeekStart } from "@/lib/week";
import hevyPool from "@/data/hevy-template-pool.json";
import { fetchHevyWorkout } from "@/lib/hevy-api";

type HevyPoolEntry = { id: string; title: string; muscle: string; equipment: string };
const poolById = new Map<string, HevyPoolEntry>(
  (hevyPool as HevyPoolEntry[]).map((t) => [t.id, t])
);

// POST /api/webhooks/hevy — receives Hevy workout events and mirrors sets
// into WorkoutLog. Workouts whose title matches "CoachIA - <Día> (<YYYY-MM-DD>)"
// are routed back to the matching DailyWorkout; other titles are ignored.

const daysEs2En: Record<string, string> = {
  Domingo: "Sunday",
  Lunes: "Monday",
  Martes: "Tuesday",
  Miercoles: "Wednesday",
  "Miércoles": "Wednesday",
  Jueves: "Thursday",
  Viernes: "Friday",
  Sabado: "Saturday",
  "Sábado": "Saturday",
};

interface HevyWebhookSet {
  weight_kg?: number | null;
  reps?: number | null;
  set_type?: string;
}

interface HevyWebhookExercise {
  exercise_template_id: string;
  sets?: HevyWebhookSet[];
}

interface HevyWebhookWorkout {
  id?: string;
  title?: string;
  start_time?: string;
  end_time?: string;
  exercises?: HevyWebhookExercise[];
}

export async function POST(req: NextRequest) {
  const expectedToken = process.env.HEVY_WEBHOOK_TOKEN;
  if (!expectedToken) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  // Hevy no permite headers custom en sus webhooks — aceptamos token via query
  // string. Mantenemos compat con header para n8n y curl manual.
  const headerAuth = req.headers.get("authorization") || req.headers.get("x-auth-token") || "";
  const headerToken = headerAuth.startsWith("Bearer ") ? headerAuth.slice(7) : headerAuth;
  const queryToken = req.nextUrl.searchParams.get("token") || "";
  const supplied = queryToken || headerToken;
  if (supplied !== expectedToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  try {
    const raw = body as Record<string, unknown>;
    let workout =
      (raw.workout as HevyWebhookWorkout | undefined) ??
      (((raw.data as Record<string, unknown> | undefined)?.workout) as HevyWebhookWorkout | undefined) ??
      (raw as HevyWebhookWorkout);

    // Hevy real payload is `{ workoutId: "..." }`. Detect that shape and fetch
    // the full workout from the Hevy API before processing.
    const inlineHasExercises = workout && Array.isArray(workout.exercises) && workout.exercises.length > 0;
    if (!inlineHasExercises) {
      const workoutId =
        (raw.workoutId as string | undefined) ??
        (((raw.data as Record<string, unknown> | undefined)?.workoutId) as string | undefined) ??
        (raw.id as string | undefined);
      if (workoutId) {
        try {
          workout = (await fetchHevyWorkout(workoutId)) as unknown as HevyWebhookWorkout;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          await sendTelegramMessage(`⚠️ Hevy webhook: fetch workout ${workoutId} falló — ${msg}`).catch(() => {});
          return NextResponse.json({ error: `fetch workout failed: ${msg}` }, { status: 502 });
        }
      }
    }

    if (!workout || !Array.isArray(workout.exercises) || workout.exercises.length === 0) {
      return NextResponse.json({ ok: true, skipped: "no workout payload" });
    }

    if (!workout.end_time) {
      return NextResponse.json({ ok: true, skipped: "workout not finished" });
    }

    const title = (workout.title || "").trim();
    const titleMatch = title.match(/CoachIA\s*-\s*(\w+)\s*\((\d{4}-\d{2}-\d{2})\)/i);
    if (!titleMatch) {
      return NextResponse.json({ ok: true, skipped: "title not CoachIA-owned" });
    }
    const [, dayEs, routineWeekStart] = titleMatch;
    const dayEn = daysEs2En[dayEs] ?? daysEs2En[dayEs.charAt(0).toUpperCase() + dayEs.slice(1).toLowerCase()];
    if (!dayEn) {
      await sendTelegramMessage(
        `⚠️ Hevy webhook: día "${dayEs}" no mapeado (title: "${title}")`
      ).catch(() => {});
      return NextResponse.json({ ok: true, skipped: "day not mapped" });
    }

    const dw = await prisma.dailyWorkout.findFirst({
      where: {
        dayOfWeek: dayEn,
        routine: { weekStart: routineWeekStart },
      },
      include: { exercises: true, routine: true },
    });
    if (!dw) {
      await sendTelegramMessage(
        `⚠️ Hevy webhook: no se encontró DailyWorkout para ${dayEn} (${routineWeekStart})`
      ).catch(() => {});
      return NextResponse.json({ ok: true, skipped: "daily workout not found" });
    }

    const allMappings = await prisma.hevyExerciseMapping.findMany();
    const coachiaByTemplateId = new Map<string, { id: string; name: string }>();
    for (const ex of dw.exercises) {
      if (ex.hevyTemplateId) {
        coachiaByTemplateId.set(ex.hevyTemplateId, ex);
        continue;
      }
      const mapping = allMappings.find((m) => m.coachiaName === ex.name);
      if (mapping) coachiaByTemplateId.set(mapping.hevyTemplateId, ex);
    }

    const logWeekStart = getCurrentWeekStart();
    let setsLogged = 0;
    const unmatched: string[] = [];
    const createdOnTheFly: string[] = [];

    for (const hevyEx of workout.exercises) {
      let coachiaEx = coachiaByTemplateId.get(hevyEx.exercise_template_id);
      const sets = hevyEx.sets || [];

      if (!coachiaEx) {
        // On-the-fly: if we know this Hevy template (it's in our curated pool),
        // create the Exercise in the current DailyWorkout so future webhooks for
        // the same template match directly. Users editing routines in Hevy drive
        // this branch (MVP accepts the edit as authoritative).
        const poolMatch = poolById.get(hevyEx.exercise_template_id);
        if (poolMatch && sets.length > 0) {
          const firstReps = sets[0]?.reps ?? null;
          const createdEx = await prisma.exercise.create({
            data: {
              dailyWorkoutId: dw.id,
              name: poolMatch.title,
              targetSets: sets.length,
              targetReps: firstReps != null ? String(firstReps) : null,
              hevyTemplateId: hevyEx.exercise_template_id,
            },
          });
          coachiaEx = { id: createdEx.id, name: createdEx.name };
          coachiaByTemplateId.set(hevyEx.exercise_template_id, coachiaEx);
          createdOnTheFly.push(poolMatch.title);
        }
      }

      if (!coachiaEx) {
        unmatched.push(hevyEx.exercise_template_id);
        continue;
      }

      for (let i = 0; i < sets.length; i++) {
        const s = sets[i];
        const weight = s.weight_kg;
        const reps = s.reps;
        if (weight == null || reps == null) continue;

        await prisma.workoutLog.upsert({
          where: {
            exerciseId_setNumber_weekStart: {
              exerciseId: coachiaEx.id,
              setNumber: i + 1,
              weekStart: logWeekStart,
            },
          },
          update: { reps, weight },
          create: {
            exerciseId: coachiaEx.id,
            setNumber: i + 1,
            weekStart: logWeekStart,
            reps,
            weight,
          },
        });
        setsLogged++;
      }
    }

    await prisma.workoutCompletion.upsert({
      where: {
        dailyWorkoutId_weekStart: {
          dailyWorkoutId: dw.id,
          weekStart: logWeekStart,
        },
      },
      update: { completed: true, completedAt: new Date() },
      create: {
        dailyWorkoutId: dw.id,
        weekStart: logWeekStart,
        completed: true,
        completedAt: new Date(),
      },
    });

    const unmatchedMsg = unmatched.length
      ? ` · ${unmatched.length} template(s) fuera del pool`
      : "";
    const createdMsg = createdOnTheFly.length
      ? ` · ${createdOnTheFly.length} ejercicio(s) nuevos (${createdOnTheFly.slice(0, 3).join(", ")}${createdOnTheFly.length > 3 ? "..." : ""})`
      : "";
    await sendTelegramMessage(
      `✅ Hevy → CoachIA: ${setsLogged} sets sincronizados — ${dayEs} (${routineWeekStart})${createdMsg}${unmatchedMsg}`
    ).catch(() => {});

    return NextResponse.json({
      ok: true,
      setsLogged,
      createdExercises: createdOnTheFly,
      unmatchedTemplates: unmatched,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await sendTelegramMessage(`⚠️ Hevy webhook error: ${msg}`).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
