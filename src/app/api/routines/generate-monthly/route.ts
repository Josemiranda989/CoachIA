import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/internal-auth";
import { sendTelegramMessage } from "@/lib/telegram";
import { GoogleGenAI, Type } from "@google/genai";
import { getValidAccessToken, fetchActivities, fetchStats } from "@/lib/strava";

const routineResponseSchema = {
  type: Type.OBJECT,
  properties: {
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayOfWeek: { type: Type.STRING },
          type: { type: Type.STRING },
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
          targetDuration: { type: Type.NUMBER },
          targetPower: { type: Type.STRING },
          notes: { type: Type.STRING },
        },
        required: ["dayOfWeek", "type"],
      },
    },
  },
  required: ["days"],
};

function getNextMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday.toISOString();
}

async function gatherAthleteData(userId: string) {
  // Gym: PRs and volume
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

  // Strava
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

// POST: Generate + save + notify — called by cron/n8n
export async function POST(request: Request) {
  try {
    const auth = await resolveAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    // Optional overrides from request body
    const body = await request.json().catch(() => ({}));
    const goal = body.goal || "Hipertrofia";
    const daysPerWeek = body.daysPerWeek || 4;
    const cyclingDays = body.cyclingDays || 2;
    const focusAreas = body.focusAreas || [];
    const notes = body.notes || "";

    const nextMonday = getNextMonday();
    const { gymSection, stravaSection } = await gatherAthleteData(auth.userId);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `Eres un entrenador personal experto en fuerza y ciclismo. Genera una rutina semanal COMPLETA de 7 días (Monday a Sunday).

DATOS DEL ATLETA:
- Objetivo principal: ${goal}
- Días de gimnasio por semana: ${daysPerWeek}
- Días de ciclismo por semana: ${cyclingDays}
- Áreas de enfoque en gym: ${focusAreas.length ? focusAreas.join(", ") : "General (todo el cuerpo)"}
${notes ? `- Notas adicionales: ${notes}` : ""}
${gymSection}
${stravaSection}

USA LOS DATOS REALES del atleta para:
- Ajustar los pesos y repeticiones de gym basándote en sus PRs (no pongas pesos genéricos, usá porcentajes realistas de sus récords)
- Ajustar la duración e intensidad del ciclismo según su nivel real (distancias, velocidad promedio, FC y potencia recientes)
- Si no hay datos de ciclismo, usá valores conservadores para principiante

PERIODIZACIÓN SEMANAL (OBLIGATORIA — el atleta prioriza el fondo largo del SÁBADO):
A. Saturday SIEMPRE es "Cycling" con el ride más largo y exigente de la semana (90-180min, Z2-Z3). Es el día prioritario; toda la semana se programa hacia atrás desde este día.
B. Las piernas pesadas en gym (sentadilla, prensa, peso muerto, zancadas, hip thrust) NUNCA pueden caer dentro de las 72 horas previas al sábado. Idealmente Tuesday, máximo Wednesday. NUNCA Thursday/Friday/Saturday.
C. El día siguiente a una sesión de piernas debe ser "Rest" o "Cycling" Z1-Z2 recovery (≤90min, intensidad baja). NUNCA intensidad alta ni otra sesión de piernas.
D. Si hay días de ciclismo con intensidad (Z3+, intervalos, umbral), programarlos con piernas frescas (Monday o Tuesday temprano). Los rides recovery van al día siguiente de piernas.
E. Friday debe ser "Rest" o gym muy ligero de tren superior (<40min). Prohibido piernas o bici intensa el viernes.
F. Sunday debe ser "Rest" o "Cycling" Z1 muy suave (≤60min) post-fondo.
G. Empuje y jalones pueden distribuirse Lunes/Miércoles/Jueves según los días de gym disponibles.

REGLAS ESTRICTAS:
1. SIEMPRE incluir los 7 días de la semana (Monday a Sunday)
2. Distribuir ${daysPerWeek} días de tipo "Gym" y ${cyclingDays} días de tipo "Cycling". Los demás son "Rest". Si un día tiene gym Y ciclismo, usar tipo "Gym + Cycling".
3. Para días Gym: incluir entre 5-8 ejercicios con nombre en ESPAÑOL, targetSets (3-5), y targetReps como rango (ej: "8-10", "12-15")
4. Para días Cycling: incluir targetDuration (60-120 minutos) y targetPower (zona como "Z2 Endurance", "Z3 Tempo", "Z4 Threshold")
5. Para días Rest: NO incluir exercises, targetDuration ni targetPower
6. Variar los grupos musculares entre días de gym (no repetir el mismo grupo dos días seguidos)
7. Los ejercicios deben ser realistas y progresivos para el objetivo "${goal}"`;

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: routineResponseSchema,
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json({ error: "Gemini no devolvió respuesta" }, { status: 502 });
    }

    const generated = JSON.parse(text);

    // Archive existing pending routines
    await prisma.routine.updateMany({
      where: { userId: auth.userId, status: "pending_approval" },
      data: { status: "archived" },
    });

    // Save with pending_approval
    const saved = await prisma.routine.create({
      data: {
        userId: auth.userId,
        weekStart: new Date(nextMonday),
        status: "pending_approval",
        days: {
          create: generated.days.map((day: any) => ({
            dayOfWeek: day.dayOfWeek,
            type: day.type,
            targetDuration: day.targetDuration ?? null,
            targetPower: day.targetPower ?? null,
            notes: day.notes ?? null,
            exercises: {
              create: (day.exercises ?? []).map((ex: any) => ({
                name: ex.name,
                targetSets: ex.targetSets,
                targetReps: ex.targetReps ?? null,
              })),
            },
          })),
        },
      },
      include: {
        days: { include: { exercises: true } },
      },
    });

    // Telegram notification
    const dayNames: Record<string, string> = {
      Monday: "Lunes", Tuesday: "Martes", Wednesday: "Miercoles",
      Thursday: "Jueves", Friday: "Viernes", Saturday: "Sabado", Sunday: "Domingo",
    };

    const summary = saved.days
      .map((d) => {
        const dayName = dayNames[d.dayOfWeek] ?? d.dayOfWeek;
        const exercises = d.exercises.length > 0
          ? d.exercises.map((e) => `  - ${e.name} ${e.targetSets}x${e.targetReps}`).join("\n")
          : "";
        const bike = d.targetDuration ? `  Bici: ${d.targetDuration}min ${d.targetPower ?? ""}` : "";
        return `<b>${dayName}</b> (${d.type})\n${exercises}${bike}`;
      })
      .join("\n\n");

    await sendTelegramMessage(
      `🏋️ Nueva rutina generada automaticamente!\n\nComienza: ${new Date(nextMonday).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}\n\n${summary}\n\n👉 Aproba o rechazala en CoachIA.`
    );

    return NextResponse.json({
      message: "Rutina generada, guardada y notificada por Telegram.",
      routineId: saved.id,
    });
  } catch (err: any) {
    console.error("Monthly generation error:", err);

    // Notify error via Telegram too
    await sendTelegramMessage(
      `⚠️ Error generando rutina mensual: ${err.message}`
    ).catch(() => {});

    return NextResponse.json(
      { error: "Error al generar rutina", details: err.message },
      { status: 500 }
    );
  }
}
