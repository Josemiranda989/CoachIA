import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleGenAI, Type } from '@google/genai';
import { getValidAccessToken, fetchActivities, fetchStats } from '@/lib/strava';

const routineResponseSchema = {
  type: Type.OBJECT,
  properties: {
    weekStart: { type: Type.STRING },
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
              required: ['name', 'targetSets', 'targetReps'],
            },
          },
          targetDuration: { type: Type.NUMBER },
          targetPower: { type: Type.STRING },
          notes: { type: Type.STRING },
        },
        required: ['dayOfWeek', 'type'],
      },
    },
  },
  required: ['weekStart', 'days'],
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
    orderBy: { id: 'desc' },
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
    .join('\n');

  const totalVolume = allLogs.reduce((acc, l) => acc + l.weight * l.reps, 0);

  const gymSection = prLines
    ? `\nDATOS DE GYM (historial real):\n- Volumen total histórico: ${totalVolume.toLocaleString()} kg\n- Récords personales (top 15):\n${prLines}`
    : '';

  // Strava: recent cycling data
  let stravaSection = '';
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

      const rides = (recentActivities || []).filter((a: any) => a.type === 'Ride' || a.type === 'VirtualRide');

      if (stats || rides.length > 0) {
        stravaSection = '\nDATOS DE CICLISMO (Strava):';

        if (stats?.ytd_ride_totals) {
          const ytd = stats.ytd_ride_totals;
          stravaSection += `\n- Este año: ${ytd.count} rides, ${(ytd.distance / 1000).toFixed(0)} km, ${Math.round(ytd.moving_time / 3600)} horas, ${Math.round(ytd.elevation_gain)} m desnivel`;
        }
        if (stats?.all_ride_totals) {
          const all = stats.all_ride_totals;
          stravaSection += `\n- Totales históricos: ${all.count} rides, ${(all.distance / 1000).toFixed(0)} km`;
        }

        if (rides.length > 0) {
          stravaSection += '\n- Últimas salidas:';
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
    // Strava not available — continue without it
  }

  return { gymSection, stravaSection };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    let userId: string | null = null;

    if ((session as any)?.user?.id) {
      userId = (session as any).user.id as string;
    } else {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) userId = firstUser.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: please login first' }, { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY no está configurada en el servidor' }, { status: 500 });
    }

    const body = await request.json();
    const { goal, daysPerWeek, cyclingDays, focusAreas, notes } = body;

    if (!goal || !daysPerWeek) {
      return NextResponse.json({ error: 'goal y daysPerWeek son requeridos' }, { status: 400 });
    }

    const nextMonday = getNextMonday();
    const { gymSection, stravaSection } = await gatherAthleteData(userId);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `Eres un entrenador personal experto en fuerza y ciclismo. Genera una rutina semanal COMPLETA de 7 días (Monday a Sunday).

DATOS DEL ATLETA:
- Objetivo principal: ${goal}
- Días de gimnasio por semana: ${daysPerWeek}
- Días de ciclismo por semana: ${cyclingDays || 0}
- Áreas de enfoque en gym: ${focusAreas?.length ? focusAreas.join(', ') : 'General (todo el cuerpo)'}
${notes ? `- Notas adicionales: ${notes}` : ''}
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
1. weekStart DEBE ser exactamente: "${nextMonday}"
2. SIEMPRE incluir los 7 días de la semana (Monday a Sunday)
3. Distribuir ${daysPerWeek} días de tipo "Gym" y ${cyclingDays || 0} días de tipo "Cycling". Los demás son "Rest". Si un día tiene gym Y ciclismo, usar tipo "Gym + Cycling".
4. Para días Gym: incluir entre 5-8 ejercicios con nombre en ESPAÑOL, targetSets (3-5), y targetReps como rango (ej: "8-10", "12-15")
5. Para días Cycling: incluir targetDuration (60-120 minutos) y targetPower (zona como "Z2 Endurance", "Z3 Tempo", "Z4 Threshold")
6. Para días Rest: NO incluir exercises, targetDuration ni targetPower
7. Variar los grupos musculares entre días de gym (no repetir el mismo grupo dos días seguidos)
8. Los ejercicios deben ser realistas y progresivos para el objetivo "${goal}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: routineResponseSchema,
      },
    });

    const text = response.text;
    if (!text) {
      return NextResponse.json({ error: 'Gemini no devolvió una respuesta válida' }, { status: 502 });
    }

    const routine = JSON.parse(text);
    routine.weekStart = nextMonday;

    return NextResponse.json(routine);
  } catch (err: any) {
    console.error('Gemini generation error:', err);
    return NextResponse.json(
      { error: 'Error al generar la rutina', details: err.message },
      { status: 500 }
    );
  }
}
