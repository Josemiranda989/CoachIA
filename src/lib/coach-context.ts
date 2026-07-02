import { prisma } from "@/lib/prisma";
import { getCurrentWeekStart } from "@/lib/week";
import { getActiveRoutineWithBlocks } from "@/lib/queries/getActiveRoutine";
import { getValidAccessToken, fetchActivities } from "@/lib/strava";
import { computeFitnessForUser } from "@/lib/fitness-data";
import { hrZonesSummary } from "@/lib/hr-zones";
import { DAY_ES, type DayName } from "@/lib/coach-tools";

const TIMEZONE = "America/Argentina/Tucuman";

function todayName(): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "long" }).format(
    new Date()
  );
}

function formatBlock(b: {
  kind: string;
  duration: number;
  targetPower: string;
  repetitions: number | null;
  recoveryDuration: number | null;
  recoveryPower: string | null;
  targetCadence: string | null;
  notes: string | null;
}): string {
  let s: string;
  if (b.kind === "interval" && b.repetitions) {
    s = `${b.repetitions}x${b.duration}' ${b.targetPower}`;
    if (b.recoveryDuration) s += ` / ${b.recoveryDuration}' ${b.recoveryPower ?? ""}`.trimEnd();
  } else {
    s = `${b.kind} ${b.duration}' ${b.targetPower}`;
  }
  if (b.targetCadence) s += ` @ ${b.targetCadence}`;
  if (b.notes) s += ` — ${b.notes}`;
  return s;
}

/**
 * Arma el contexto completo del Chat Coach: rutina de la semana, Strava
 * reciente, balanza (peso + tendencia), fitness (CTL/ATL/TSB) y referencias
 * FTP/LTHR/zonas. Devuelve también el routineId activo para aplicar mutaciones.
 */
export async function buildCoachContext(userId: string): Promise<{
  systemPrompt: string;
  routineId: string | null;
}> {
  const weekStart = getCurrentWeekStart();

  const [routine, user, weights, fitness] = await Promise.all([
    getActiveRoutineWithBlocks(userId, weekStart),
    prisma.user.findUnique({
      where: { id: userId },
      select: { fcMax: true, lthr: true, ftp: true },
    }),
    prisma.bodyWeight.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 30,
    }),
    computeFitnessForUser(userId, 90).catch(() => null),
  ]);

  // ── Semana actual ──
  let weekSection = "SEMANA ACTUAL: sin rutina activa cargada.";
  if (routine) {
    const order: Record<string, number> = {
      Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7,
    };
    const lines = [...routine.days]
      .sort((a, b) => (order[a.dayOfWeek] ?? 8) - (order[b.dayOfWeek] ?? 8))
      .map((d) => {
        const es = DAY_ES[d.dayOfWeek as DayName] ?? d.dayOfWeek;
        const done = d.completions[0]?.completed ? " [COMPLETADO]" : "";
        if (d.type === "Rest") return `- ${d.dayOfWeek} (${es}): Descanso${done}`;
        const parts: string[] = [];
        if (d.exercises.length > 0) {
          parts.push(`Gym: ${d.exercises.map((e) => `${e.name} ${e.targetSets}x${e.targetReps ?? "?"}`).join(", ")}`);
        }
        if (d.blocks.length > 0) {
          parts.push(
            `Bici ${d.targetDuration ?? "?"}min ${d.targetPower ?? ""}: ${d.blocks.map(formatBlock).join(" | ")}`
          );
        }
        const notes = d.notes ? ` — "${d.notes}"` : "";
        return `- ${d.dayOfWeek} (${es}): [${d.type}] ${parts.join(" · ")}${notes}${done}`;
      });
    weekSection = `SEMANA ACTUAL (weekStart ${routine.weekStart}):\n${lines.join("\n")}`;
  }

  // ── Strava reciente ──
  let stravaSection = "ACTIVIDADES RECIENTES (Strava): sin conexión a Strava.";
  try {
    const token = await getValidAccessToken(userId);
    if (token) {
      const acts = await fetchActivities(token, 1, 10);
      const rides = (acts || []).filter((a: any) => a.type === "Ride" || a.type === "VirtualRide");
      if (rides.length) {
        const lines = rides.map((r: any) => {
          const date = r.start_date?.slice(0, 10) ?? "?";
          const dist = (r.distance / 1000).toFixed(1);
          const mins = Math.round(r.moving_time / 60);
          let line = `- ${date} "${r.name}"${r.type === "VirtualRide" ? " [rodillo/virtual]" : ""}: ${dist} km, ${mins} min`;
          if (r.average_heartrate) line += `, FC ${Math.round(r.average_heartrate)} bpm`;
          if (r.average_watts) line += `, ${Math.round(r.average_watts)} W`;
          if (r.average_cadence) line += `, ${Math.round(r.average_cadence)} rpm`;
          if (typeof r.suffer_score === "number") line += `, TSS≈${Math.round(r.suffer_score)}`;
          return line;
        });
        stravaSection = `ACTIVIDADES RECIENTES (Strava, más nueva primero):\n${lines.join("\n")}`;
      } else {
        stravaSection = "ACTIVIDADES RECIENTES (Strava): sin rides recientes.";
      }
    }
  } catch {
    // Strava caído no bloquea el chat
  }

  // ── Balanza ──
  let weightSection = "BALANZA: sin datos de peso.";
  if (weights.length > 0) {
    const latest = weights[0];
    const oldest = weights[weights.length - 1];
    const deltaDays = Math.max(
      1,
      Math.round((latest.date.getTime() - oldest.date.getTime()) / 86_400_000)
    );
    const delta = latest.weight - oldest.weight;
    weightSection = `BALANZA (Xiaomi):
- Peso actual: ${latest.weight.toFixed(1)} kg (${latest.date.toISOString().slice(0, 10)})${latest.bodyFat != null ? `, grasa ${latest.bodyFat.toFixed(1)}%` : ""}${latest.muscle != null ? `, músculo ${latest.muscle.toFixed(1)}%` : ""}
- Tendencia: ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg en los últimos ${deltaDays} días`;
  }

  // ── Fitness ──
  let fitnessSection = "FITNESS: sin datos (Strava desconectado).";
  if (fitness?.current) {
    const c = fitness.current;
    fitnessSection = `FITNESS (CTL/ATL/TSB, modelo Coggan sobre TSS de Strava):
- CTL (fitness): ${c.ctl} · ATL (fatiga): ${c.atl} · TSB (forma): ${c.tsb}
- Lectura: TSB < -20 = fatiga alta (bajar carga); -20..0 = entrenando bien; 0..+10 = fresco; > +10 = muy fresco/detrenando`;
  }

  // ── Referencias ──
  const ftp = user?.ftp ?? 140;
  const hrSection = user ? hrZonesSummary({ fcMax: user.fcMax, lthr: user.lthr }) : null;
  const wkg = weights.length > 0 ? (ftp / weights[0].weight).toFixed(2) : null;

  const systemPrompt = `Sos el coach personal de ciclismo y fuerza del atleta en CoachIA. Hablás en español rioplatense, directo y claro, como un entrenador que conoce a su atleta. HOY ES ${todayName()} (${DAY_ES[todayName() as DayName] ?? todayName()}).

REFERENCIAS DEL ATLETA:
- FTP: ${ftp} W${wkg ? ` (${wkg} W/kg)` : ""}
- Zonas de potencia (%FTP): Z1 <${Math.round(ftp * 0.55)}W · Z2 ${Math.round(ftp * 0.56)}-${Math.round(ftp * 0.75)}W · Z3 ${Math.round(ftp * 0.76)}-${Math.round(ftp * 0.9)}W · Z4 ${Math.round(ftp * 0.91)}-${Math.round(ftp * 1.05)}W · Z5 ${Math.round(ftp * 1.06)}-${Math.round(ftp * 1.2)}W
${hrSection ? `- ${hrSection.split("\n").join("\n- ")}` : ""}
- Equipamiento: MTB + rodillo smart Thinkrider X2 Pro (ERG, potencia real) + sensor de cadencia + banda de FC. Indoor usa MyWhoosh o ERG; outdoor usa ciclocomputador iGPSport.

${weekSection}

${stravaSection}

${weightSection}

${fitnessSection}

REGLAS DE ENTRENAMIENTO (no negociables al proponer cambios):
- El atleta NO entrena en Z1: Z2 es el piso para TODO (warmup, cooldown, recovery, recoveryPower). NUNCA propongas bloques Z1.
- Intervals: ratio recovery/trabajo 1:1 (rep de 2-5min → recovery igual). Excepción 2:1 solo si la rep dura ≥10min.
- kind="steady" solo en Z2-Z3. Z4 siempre interval con ≥2 reps; Z5 siempre interval con ≥3 reps.
- 1 solo día de calidad (intervals) de ciclismo por semana. Sábado = long ride SUAVE (Z2), nunca intervals. Domingo = descanso.
- Piernas pesadas de gym: mínimo 72hs antes del sábado. Día post-leg-day: descanso o bici Z2 suave ≤90min.
- Cadencia: auto-seleccionada 80-90 rpm; >90 le cuesta neuromuscularmente. Spin-up drills solo en Z2 y watts bajos.

CÓMO ACTUÁS:
1. Si el atleta pide un CAMBIO en la semana (bajar intensidad, mover un día, acortar, pasar a descanso, adaptar a rodillo), usá las tools. Las tools son PROPUESTAS: el atleta las confirma en la UI antes de aplicarse. Podés emitir varias tool calls en un mismo mensaje si el cambio lo requiere.
2. Si es una CONSULTA (cómo venís, qué significa este dato, nutrición, sensaciones), respondé directo con los datos de arriba. No inventes datos que no tenés.
3. Fundamentá cada cambio en evidencia (TSB, últimas rides, peso, lo que cuenta el atleta). Si el pedido contradice las reglas (ej. meter intervals el sábado), explicá por qué no y ofrecé alternativa.
4. Los días de GYM no se editan por acá: solo se MUEVEN (move_workout). El contenido de gym vive en Hevy.
5. Sé conciso: 2-4 oraciones por respuesta más las tool calls que hagan falta.`;

  return { systemPrompt, routineId: routine?.id ?? null };
}
