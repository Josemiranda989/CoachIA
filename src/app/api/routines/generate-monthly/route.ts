import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { sendTelegramMessage } from "@/lib/telegram";
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
      description: "Exactly 4 weeks. Each week is an array of overrides for the cycling days only. dayOfWeek must match a Cycling/Gym + Cycling day from gymTemplate.",
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            dayOfWeek: { type: Type.STRING },
            targetDuration: { type: Type.NUMBER },
            targetPower: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
          required: ["dayOfWeek", "targetDuration", "targetPower"],
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
- Ajustar pesos y reps de gym basándote en sus PRs (porcentajes realistas, no valores genéricos)
- Diseñar la PROGRESIÓN de ciclismo según su nivel real (distancias, velocidad, FC y potencia)
- Si no hay datos de ciclismo, valores conservadores

ESTRUCTURA DE RESPUESTA — DOS PARTES:

1. **gymTemplate**: 7 días Monday→Sunday, define la estructura SEMANAL FIJA. Para días tipo "Cycling" o "Gym + Cycling" → exercises vacío, NO incluyas duración/potencia (eso va en cyclingByWeek). Para días "Gym" → ejercicios con sets/reps. Para "Rest" → exercises vacío.

2. **cyclingByWeek**: 4 arrays (uno por cada una de las 4 semanas). Cada array contiene SÓLO los días que tienen Cycling, con su targetDuration, targetPower, y notes específicas de esa semana.

PERIODIZACIÓN SEMANAL (para gymTemplate — OBLIGATORIA):
A. Saturday SIEMPRE es "Cycling" con el ride más largo de la semana. Es el día prioritario.
B. Las piernas pesadas en gym (sentadilla, prensa, peso muerto, zancadas, hip thrust) NUNCA dentro de las 72hs previas al sábado. Idealmente Tuesday, máximo Wednesday. NUNCA Thursday/Friday/Saturday.
C. El día siguiente a piernas debe ser "Rest" o "Cycling" Z1-Z2 recovery (≤90min). NUNCA intensidad alta ni piernas otra vez.
D. Si hay cycling con intensidad (Z3+, intervalos), programalo con piernas frescas (Monday o Tuesday temprano). Recovery rides van post-piernas.
E. Friday → "Rest" o gym muy ligero de tren superior (<40min). Prohibido piernas o bici intensa.
F. Sunday → "Rest" o "Cycling" Z1 muy suave (≤60min) post-fondo.
G. Empuje y jalones se distribuyen Lunes/Miércoles/Jueves según los días disponibles.

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

    // Archive previous active routines that fall before the new mesocycle
    const firstNewMonday = mondays[0];
    await prisma.routine.updateMany({
      where: {
        userId: auth.userId,
        status: { in: ["active", "pending_approval"] },
        weekStart: { lt: firstNewMonday },
      },
      data: { status: "archived" },
    });
    // Also archive any pending_approval that overlaps with the new range (avoid duplicates)
    await prisma.routine.updateMany({
      where: {
        userId: auth.userId,
        status: "pending_approval",
        weekStart: { gte: firstNewMonday },
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
        return {
          dayOfWeek: d.dayOfWeek,
          type: d.type,
          notes: cycling?.notes ?? d.notes ?? null,
          targetDuration: cycling?.targetDuration ?? null,
          targetPower: cycling?.targetPower ?? null,
          exercises: {
            create: (d.exercises ?? []).map((ex: any) => ({
              name: ex.name,
              targetSets: ex.targetSets,
              targetReps: ex.targetReps ?? null,
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
          .map((c: any) => `   • ${dayNames[c.dayOfWeek] ?? c.dayOfWeek}: ${c.targetDuration}min ${c.targetPower}`)
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
