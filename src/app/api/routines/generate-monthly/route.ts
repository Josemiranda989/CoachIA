import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { sendTelegramMessage } from "@/lib/telegram";
import { getCurrentWeekStart } from "@/lib/week";
import { GoogleGenAI, Type } from "@google/genai";
import { getValidAccessToken, fetchActivities, fetchStats } from "@/lib/strava";

const monthlyResponseSchema = {
  type: Type.OBJECT,
  properties: {
    gymTemplate: {
      type: Type.ARRAY,
      description: "7 days (Monday-Sunday). Gym/Rest layout that repeats every week of the month. For Cycling days, leave exercises empty and omit cycling fields here — those are filled per week in cyclingByWeek.",
      items: {
        type: Type.OBJECT,
        properties: {
          dayOfWeek: { type: Type.STRING },
          type: { type: Type.STRING, description: "'Gym', 'Cycling', 'Rest', or 'Gym + Cycling'" },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                targetSets: { type: Type.NUMBER },
                targetReps: { type: Type.STRING },
              },
              required: ["name", "targetSets", "targetReps"],
            },
          },
          notes: { type: Type.STRING },
        },
        required: ["dayOfWeek", "type"],
      },
    },
    cyclingByWeek: {
      type: Type.ARRAY,
      description: "Exactly 4 weeks. Each week is an array of cycling overrides. dayOfWeek must match a Cycling/Gym + Cycling day from gymTemplate. Every cycling day MUST include a structured `blocks` array describing warmup, intervals, and cooldown.",
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            dayOfWeek: { type: Type.STRING },
            totalDuration: { type: Type.NUMBER, description: "Total minutes including warmup + all reps + all recoveries + cooldown" },
            totalPower: { type: Type.STRING, description: "Short summary label, e.g. 'Z2' or 'Z2 + 4xZ4'" },
            blocks: {
              type: Type.ARRAY,
              description: "Ordered blocks making up the ride. Must sum to totalDuration.",
              items: {
                type: Type.OBJECT,
                properties: {
                  kind: { type: Type.STRING, description: "'warmup' | 'steady' | 'interval' | 'cooldown'" },
                  duration: { type: Type.NUMBER, description: "Minutes. For kind='interval' this is the duration of EACH rep (not total)." },
                  targetPower: { type: Type.STRING, description: "'Z1', 'Z2', 'Z3', 'Z4', 'Z5', or '%FTP' notation" },
                  repetitions: { type: Type.NUMBER, description: "Only for kind='interval'. Number of repeats, e.g. 4 for '4x4min Z4'." },
                  recoveryDuration: { type: Type.NUMBER, description: "Only for kind='interval'. Recovery minutes between reps." },
                  recoveryPower: { type: Type.STRING, description: "Only for kind='interval'. Zone for recovery, usually Z1 or Z2." },
                  notes: { type: Type.STRING },
                },
                required: ["kind", "duration", "targetPower"],
              },
            },
            notes: { type: Type.STRING },
          },
          required: ["dayOfWeek", "totalDuration", "totalPower", "blocks"],
        },
      },
    },
  },
  required: ["gymTemplate", "cyclingByWeek"],
};

function getNextFourMondays(): string[] {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const first = new Date(now);
  first.setDate(now.getDate() + daysUntilMonday);
  first.setHours(0, 0, 0, 0);

  const mondays: string[] = [];
  for (let i = 0; i < 4; i++) {
    const m = new Date(first);
    m.setDate(first.getDate() + i * 7);
    const y = m.getFullYear();
    const mo = String(m.getMonth() + 1).padStart(2, "0");
    const d = String(m.getDate()).padStart(2, "0");
    mondays.push(`${y}-${mo}-${d}`);
  }
  return mondays;
}

async function gatherAthleteData(userId: string) {
  const allLogs = await prisma.workoutLog.findMany({
    include: { exercise: { select: { name: true } } },
    orderBy: { id: "desc" },
    take: 500,
  });

  const prs: Record<string, { weight: number; reps: number }> = {};
  for (const log of allLogs) {
    const name = log.exercise.name;
    if (!prs[name] || log.weight > prs[name].weight) {
      prs[name] = { weight: log.weight, reps: log.reps };
    }
  }
  const prLines = Object.entries(prs)
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 15)
    .map(([name, { weight, reps }]) => `  - ${name}: ${weight} kg x ${reps} reps`)
    .join("\n");

  const totalVolume = allLogs.reduce((acc, l) => acc + l.weight * l.reps, 0);

  const gymSection = prLines
    ? `\nDATOS DE GYM (historial real):\n- Volumen total histórico: ${totalVolume.toLocaleString()} kg\n- Récords personales (top 15):\n${prLines}`
    : "";

  let stravaSection = "";
  try {
    const stravaToken = await getValidAccessToken(userId);
    if (stravaToken) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stravaAthleteId: true },
      });

      const [recentActivities, stats] = await Promise.all([
        fetchActivities(stravaToken, 1, 5),
        user?.stravaAthleteId ? fetchStats(stravaToken, user.stravaAthleteId) : null,
      ]);

      const rides = (recentActivities || []).filter(
        (a: any) => a.type === "Ride" || a.type === "VirtualRide"
      );

      if (stats || rides.length > 0) {
        stravaSection = "\nDATOS DE CICLISMO (Strava):";

        if (stats?.ytd_ride_totals) {
          const ytd = stats.ytd_ride_totals;
          stravaSection += `\n- Este año: ${ytd.count} rides, ${(ytd.distance / 1000).toFixed(0)} km, ${Math.round(ytd.moving_time / 3600)} horas, ${Math.round(ytd.elevation_gain)} m desnivel`;
        }
        if (stats?.all_ride_totals) {
          const all = stats.all_ride_totals;
          stravaSection += `\n- Totales históricos: ${all.count} rides, ${(all.distance / 1000).toFixed(0)} km`;
        }

        if (rides.length > 0) {
          stravaSection += "\n- Últimas salidas:";
          for (const ride of rides.slice(0, 5)) {
            const dist = (ride.distance / 1000).toFixed(1);
            const hrs = Math.floor(ride.moving_time / 3600);
            const mins = Math.floor((ride.moving_time % 3600) / 60);
            const speed = (ride.average_speed * 3.6).toFixed(1);
            let line = `  - ${ride.name}: ${dist} km, ${hrs}h${mins}m, ${speed} km/h avg`;
            if (ride.average_heartrate) line += `, FC ${Math.round(ride.average_heartrate)} bpm`;
            if (ride.average_watts) line += `, ${Math.round(ride.average_watts)} W`;
            stravaSection += `\n${line}`;
          }
        }
      }
    }
  } catch {
    // Strava not available
  }

  return { gymSection, stravaSection };
}

async function alertAndRespond(msg: string, status: number) {
  await sendTelegramMessage(`⚠️ Mesociclo mensual: ${msg}`).catch(() => {});
  return NextResponse.json({ error: msg }, { status });
}

// POST: Generate monthly plan (4 weeks: same gym template, progressive cycling) — called by cron/n8n
export async function POST(request: Request) {
  try {
    const auth = await resolveAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!process.env.GEMINI_API_KEY) {
      return alertAndRespond("GEMINI_API_KEY not configured", 500);
    }

    const body = await request.json().catch(() => ({}));
    const goal = body.goal || "Hipertrofia";
    const daysPerWeek = body.daysPerWeek || 4;
    const cyclingDays = body.cyclingDays || 2;
    const focusAreas = body.focusAreas || [];
    const notes = body.notes || "";

    const mondays = getNextFourMondays();
    const { gymSection, stravaSection } = await gatherAthleteData(auth.userId);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `Eres un entrenador personal experto en fuerza y ciclismo. Genera un MESOCICLO DE 4 SEMANAS: la rutina de gym es FIJA y se repite cada semana (el atleta progresa carga manualmente), y el ciclismo PROGRESA semana a semana (mesociclo build/build/build/recovery).

DATOS DEL ATLETA:
- Objetivo principal: ${goal}
- Días de gimnasio por semana: ${daysPerWeek}
- Días de ciclismo por semana: ${cyclingDays}
- Áreas de enfoque en gym: ${focusAreas.length ? focusAreas.join(", ") : "General (todo el cuerpo)"}
${notes ? `- Notas adicionales: ${notes}` : ""}
${gymSection}
${stravaSection}

USA LOS DATOS REALES del atleta para:
- Ajustar pesos y reps de gym basándote en sus PRs. Para el primer set sugerí ~70-80% del PR como punto de partida (el atleta progresa carga manualmente).
- Diseñar la PROGRESIÓN de ciclismo según su nivel real (distancias, velocidad, FC y potencia).
- Si hay average_watts en las rides Strava, estimá FTP ≈ mejor average_watts sostenido en ~60-90min × 0.95. Usá ese FTP para calibrar las zonas. Podés opcionalmente anotar watts entre paréntesis en targetPower (ej "Z4 (~230W)").
- Si no hay datos de ciclismo, usá valores conservadores pensando en alguien en su primer año de entreno estructurado.

ZONAS DE POTENCIA (Coggan 7-zone model, %FTP):
- Z1 Recovery activo: <55% FTP — rides post-piernas, very easy
- Z2 Endurance: 56-75% FTP — base, la mayoría del volumen semanal
- Z3 Tempo: 76-90% FTP — ritmo "confortable rápido", conversación entrecortada
- Z4 Threshold: 91-105% FTP — umbral, sostenible 30-60min máximo
- Z5 VO2max: 106-120% FTP — máximo aeróbico, sostenible 3-8min
- Z6+ Anaeróbico: >120% — sprints/all-out, sostenible segundos a 1-2min

ESTRUCTURA DE RESPUESTA — DOS PARTES:

1. **gymTemplate**: 7 días Monday→Sunday, estructura SEMANAL FIJA. Para días "Cycling" o "Gym + Cycling" → exercises vacío, NO incluyas duración/potencia (va en cyclingByWeek). Para "Gym" → ejercicios con sets/reps. Para "Rest" → exercises vacío.

2. **cyclingByWeek**: 4 arrays (uno por semana). Cada array contiene los días Cycling con **totalDuration**, **totalPower** (label), **blocks** (detalle ordenado), y **notes** (propósito).

FORMATO DE BLOCKS (OBLIGATORIO para cada día Cycling):
- Cada ride tiene 3-5 bloques ordenados: warmup → (steady|interval) × N → cooldown.
- **warmup**: kind="warmup", duration 10-20min, targetPower Z1 o Z1-Z2 progresivo.
- **steady**: kind="steady", duration, targetPower. Un bloque sostenido en UNA zona.
- **interval**: kind="interval" formato COMPRIMIDO: duration=duración DE CADA rep, repetitions=cantidad, recoveryDuration=min entre reps, recoveryPower=zona recovery. Ej "4x4min Z4 con 3min Z2 rec" → {kind:"interval", duration:4, targetPower:"Z4", repetitions:4, recoveryDuration:3, recoveryPower:"Z2"}.
- **cooldown**: kind="cooldown", duration 8-15min, targetPower Z1.

DURACIONES DE REP POR ZONA (fisiológicamente realistas — NO VIOLAR):
- Z3 Tempo: 8-20min por rep, 3-5min recovery Z1-Z2
- Z4 Threshold: 5-15min por rep, 3-5min recovery Z2
- Z5 VO2max: 2-5min por rep, 2-3x la duración en recovery Z1
- Z6+ Anaeróbico: 30s-2min por rep, 2-4x recovery Z1

DURACIONES TOTALES TÍPICAS DE RIDE:
- Recovery ride (Sunday, post-piernas): 40-80min
- Ride con intervals (VO2max/Threshold): 45-90min total
- Tempo/sub-umbral sostenido: 60-90min
- Long ride sábado: 90-180min (no pasarse de 180)

ORDEN DE BLOCKS (guías):
- Después de un bloque de intervals, ir DIRECTO al cooldown. No intercalar "steady" entre intervals y cooldown salvo que haya 2 sets distintos de intervals separados.
- Recovery rides: warmup + steady Z1-Z2 + cooldown. SIN intervals.
- Rides con intensidad: warmup + (interval) + cooldown. O: warmup + steady Z2 + interval + cooldown.
- La suma de warmup + Σ(rep × (duration + recoveryDuration) para intervals) + Σ(steady.duration) + cooldown DEBE igualar totalDuration exactamente.

USO DEL CAMPO `notes` EN CYCLING:
- Explicar el PROPÓSITO de la sesión (qué adaptación busca, qué priorizar, qué evitar).
- Máximo 1 oración útil al atleta durante el entreno. Ej:
  - "Fondo base del mesociclo. Z2 bajo todo el ride, no acelerar al final."
  - "Sesión clave VO2max. Primer rep suave, últimos 2 a 120%FTP."
  - "Recovery post-piernas. Cadencia alta >90rpm, NO subir pulsaciones."

EJEMPLOS COMPLETOS DE DÍAS CYCLING:

Ejemplo A — Saturday long ride BUILD (120min total):
{
  "dayOfWeek":"Saturday", "totalDuration":120, "totalPower":"Z2",
  "blocks":[
    {"kind":"warmup","duration":15,"targetPower":"Z1"},
    {"kind":"steady","duration":90,"targetPower":"Z2"},
    {"kind":"cooldown","duration":15,"targetPower":"Z1"}
  ],
  "notes":"Fondo base del mesociclo. Z2 bajo todo el ride, no acelerar al final."
}

Ejemplo B — Wednesday VO2max PEAK (60min total):
{
  "dayOfWeek":"Wednesday", "totalDuration":60, "totalPower":"Z2 + 4xZ5",
  "blocks":[
    {"kind":"warmup","duration":15,"targetPower":"Z1-Z2"},
    {"kind":"interval","duration":4,"targetPower":"Z5","repetitions":4,"recoveryDuration":4,"recoveryPower":"Z1"},
    {"kind":"cooldown","duration":13,"targetPower":"Z1"}
  ],
  "notes":"Sesión clave. 4x4 VO2max. Primer rep suave, últimos 2 a 120%FTP."
}

Ejemplo C — Sunday recovery (50min total):
{
  "dayOfWeek":"Sunday", "totalDuration":50, "totalPower":"Z1",
  "blocks":[
    {"kind":"warmup","duration":10,"targetPower":"Z1"},
    {"kind":"steady","duration":30,"targetPower":"Z1"},
    {"kind":"cooldown","duration":10,"targetPower":"Z1"}
  ],
  "notes":"Recovery post-long ride. Cadencia alta >90rpm, FC debajo de Z2, NO acelerar."
}

PERIODIZACIÓN SEMANAL (para gymTemplate — OBLIGATORIA):
A. Saturday es el ride MÁS LARGO de la semana PERO en intensidad SUAVE (Z1-Z2). El atleta sale con amigos a ritmo social los fines de semana. NUNCA meter intervals, Z4 ni Z5 el sábado. Notes del sábado: énfasis en mantener Z2 bajo.
A2. La intensidad del mesociclo vive en la sesión INTERVAL entre semana (Tuesday o Wednesday, con piernas frescas). Ahí van los Z3-Z5 cuando aplica. Si hay 2 cycling days, uno es el sábado largo-suave, el otro es el interval day.
B. Las piernas pesadas en gym (sentadilla, prensa, peso muerto, zancadas, hip thrust) NUNCA dentro de las 72hs previas al sábado. Idealmente Tuesday, máximo Wednesday. NUNCA Thursday/Friday/Saturday.
C. El día siguiente a piernas debe ser "Rest" o "Cycling" Z1-Z2 recovery (≤90min). NUNCA intensidad alta ni piernas otra vez.
D. El interval day de cycling SIEMPRE con piernas frescas (mismo Tuesday o Wednesday — si ese día es leg day de gym, el interval va al otro día).
E. Friday → "Rest" o gym muy ligero de tren superior (<40min). Prohibido piernas o bici intensa.
F. Sunday → "Rest" o "Cycling" Z1 muy suave (≤60min) post-sábado largo.
G. Empuje y jalones se distribuyen Lunes/Miércoles/Jueves según los días disponibles.

ESTILO DEL ATLETA (preferencias extraídas de un plan real que le funcionó):
- Vocabulario de intensidad por RPE — úsalo en el campo `notes` para que el atleta entienda el feel esperado (además del targetPower):
  - "suave" = Z1-Z2 bajo, conversación fluida
  - "ligero" = Z2 cómodo
  - "medio exigido" = Z3 tempo
  - "fuerte sostenible" = Z4 umbral
  - "fuerte" / "máximo" = Z5+ (raro)
- Ratios recovery/trabajo en intervals (respetá estos):
  - Reps cortos (2-5min) → ratio 1:1 (recup = duración del trabajo)
  - Reps largos (10min) → ratio 2:1 (recup = mitad del trabajo, ej 10min work / 5min rec)
- Días de descanso absoluto crecen con la intensidad del mesociclo:
  - Semanas 1-2 (BUILD): 1-2 días de Rest/semana
  - Semana 3 (PEAK): 2-3 días de Rest/semana
  - Semana 4 (RECOVERY): 2-3 días de Rest/semana + rides muy suaves
- Progresión de intervals durante el mesociclo (variá el formato cada 1-2 semanas para estimular adaptaciones distintas):
  - Sem 1-2: reps medios (3-5min) a intensidad moderada-media (Z3-Z4 bajo)
  - Sem 3 (PEAK): reps más largos (4-10min) o más intensos (Z4-Z5)
  - Sem 4 (RECOVERY): NO intervals. Todo Z1-Z2.

PROGRESIÓN MENSUAL DE CICLISMO (para cyclingByWeek):
- Semana 1 (BUILD): volumen base, mayoría Z2, una sesión Z3 si hay 2+ cycling days
- Semana 2 (BUILD): +10-15% volumen vs sem 1, manten intensidad
- Semana 3 (PEAK): mantener volumen sem 2 pero subir intensidad (más Z3-Z4 en Wednesday si aplica)
- Semana 4 (RECOVERY): -30-40% volumen, todo Z1-Z2, ride más corto el sábado

REGLAS ESTRICTAS:
1. gymTemplate SIEMPRE tiene los 7 días (Monday a Sunday)
2. Distribuir ${daysPerWeek} días "Gym" y ${cyclingDays} días "Cycling". Resto "Rest". Si día tiene gym Y bici, usar "Gym + Cycling".
3. Días Gym: 5-8 ejercicios con nombre en ESPAÑOL, targetSets (3-5), targetReps como rango ("8-10", "12-15")
4. Días Rest: NO incluir exercises
5. cyclingByWeek tiene EXACTAMENTE 4 arrays. Cada uno con tantas entries como días Cycling/Gym + Cycling tengas en gymTemplate.
6. dayOfWeek en cyclingByWeek debe matchear los días Cycling de gymTemplate.
7. Variar grupos musculares entre días gym (no repetir el mismo grupo seguido)
8. Ejercicios realistas y progresivos para el objetivo "${goal}"`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: monthlyResponseSchema,
      },
    });

    const text = response.text;
    if (!text) {
      return alertAndRespond("Gemini no devolvió respuesta", 502);
    }

    const generated = JSON.parse(text);
    const gymTemplate: any[] = generated.gymTemplate;
    const cyclingByWeek: any[][] = generated.cyclingByWeek;

    if (!Array.isArray(gymTemplate) || gymTemplate.length !== 7) {
      return alertAndRespond("gymTemplate must have exactly 7 days", 502);
    }
    if (!Array.isArray(cyclingByWeek) || cyclingByWeek.length !== 4) {
      return alertAndRespond("cyclingByWeek must have exactly 4 weeks", 502);
    }

    const firstNewMonday = mondays[0];

    // Archive active routines whose week has strictly passed. The in-progress week
    // survives until it naturally ends, so there is no gap between generation day
    // and the first new week of the mesocycle.
    const currentWeekMonday = getCurrentWeekStart();
    await prisma.routine.updateMany({
      where: {
        userId: auth.userId,
        status: "active",
        weekStart: { lt: currentWeekMonday },
      },
      data: { status: "archived" },
    });

    // Archive any stale pending_approval (both older ones and ones that overlap with
    // the new mesocycle range) to avoid duplicates after the user approves.
    await prisma.routine.updateMany({
      where: {
        userId: auth.userId,
        status: "pending_approval",
      },
      data: { status: "archived" },
    });

    const created: { id: string; weekStart: string }[] = [];

    for (let weekIdx = 0; weekIdx < 4; weekIdx++) {
      const weekStart = mondays[weekIdx];
      const cyclingForWeek = cyclingByWeek[weekIdx] ?? [];
      const cyclingByDay: Record<string, any> = {};
      for (const c of cyclingForWeek) cyclingByDay[c.dayOfWeek] = c;

      const days = gymTemplate.map((d: any) => {
        const cycling = cyclingByDay[d.dayOfWeek];
        const blocksRaw: any[] = Array.isArray(cycling?.blocks) ? cycling.blocks : [];

        return {
          dayOfWeek: d.dayOfWeek,
          type: d.type,
          notes: cycling?.notes ?? d.notes ?? null,
          targetDuration: cycling?.totalDuration ?? cycling?.targetDuration ?? null,
          targetPower: cycling?.totalPower ?? cycling?.targetPower ?? null,
          exercises: {
            create: (d.exercises ?? []).map((ex: any) => ({
              name: ex.name,
              targetSets: ex.targetSets,
              targetReps: ex.targetReps ?? null,
            })),
          },
          blocks: {
            create: blocksRaw.map((b: any, idx: number) => ({
              order: idx,
              kind: b.kind,
              duration: b.duration,
              targetPower: b.targetPower,
              repetitions: b.repetitions ?? null,
              recoveryDuration: b.recoveryDuration ?? null,
              recoveryPower: b.recoveryPower ?? null,
              notes: b.notes ?? null,
            })),
          },
        };
      });

      const saved = await prisma.routine.create({
        data: {
          userId: auth.userId,
          weekStart,
          status: "pending_approval",
          days: { create: days },
        },
      });

      created.push({ id: saved.id, weekStart });
    }

    // Telegram summary: gym template once + cycling progression per week
    const dayNames: Record<string, string> = {
      Monday: "Lun", Tuesday: "Mar", Wednesday: "Mié",
      Thursday: "Jue", Friday: "Vie", Saturday: "Sáb", Sunday: "Dom",
    };

    const gymSummary = gymTemplate
      .filter((d: any) => (d.exercises?.length ?? 0) > 0)
      .map((d: any) => {
        const lines = d.exercises.map((e: any) => `   • ${e.name} ${e.targetSets}x${e.targetReps}`).join("\n");
        return `<b>${dayNames[d.dayOfWeek] ?? d.dayOfWeek}</b> (${d.type})\n${lines}`;
      })
      .join("\n\n");

    const cyclingSummary = cyclingByWeek
      .map((week, idx) => {
        const monday = mondays[idx];
        const lines = week
          .map((c: any) => {
            const total = c.totalDuration ?? c.targetDuration ?? 0;
            const power = c.totalPower ?? c.targetPower ?? "";
            return `   • ${dayNames[c.dayOfWeek] ?? c.dayOfWeek}: ${total}min ${power}`;
          })
          .join("\n");
        return `<b>Semana ${idx + 1}</b> (desde ${monday})\n${lines}`;
      })
      .join("\n\n");

    await sendTelegramMessage(
      `🏋️🚴 Mesociclo de 4 semanas generado!\n\nDesde: ${mondays[0]} hasta domingo ${mondays[3]} +6d\n\n<b>GYM (mismo todas las semanas)</b>\n\n${gymSummary}\n\n<b>CICLISMO (progresivo)</b>\n\n${cyclingSummary}\n\n👉 Aprobá o rechazá en CoachIA.`
    );

    return NextResponse.json({
      message: "Mesociclo de 4 semanas generado, guardado y notificado por Telegram.",
      routines: created,
    });
  } catch (err: any) {
    console.error("Monthly generation error:", err);

    await sendTelegramMessage(
      `⚠️ Error generando mesociclo mensual: ${err.message}`
    ).catch(() => {});

    return NextResponse.json(
      { error: "Error al generar rutina", details: err.message },
      { status: 500 }
    );
  }
}
