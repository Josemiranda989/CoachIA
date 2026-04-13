import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { getValidAccessToken, fetchActivities, fetchStats } from '@/lib/strava';

function getNextMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday.toISOString();
}

export async function POST(request: Request) {
  try {
    // Auth check (same pattern as /api/routines)
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

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY no está configurada en el servidor' }, { status: 500 });
    }

    const body = await request.json();
    const { goal, daysPerWeek, cyclingDays, focusAreas, notes } = body;

    if (!goal || !daysPerWeek) {
      return NextResponse.json({ error: 'goal y daysPerWeek son requeridos' }, { status: 400 });
    }

    const nextMonday = getNextMonday();

    const client = new Anthropic();

    // ── Gather real athlete data ──

    // Gym: PRs and recent volume
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

    const gymSection = prLines
      ? `\nDATOS DE GYM (historial real):\n- Volumen total histórico: ${totalVolume.toLocaleString()} kg\n- Récords personales (top 15):\n${prLines}`
      : '';

    const prompt = `Eres un entrenador personal experto en fuerza y ciclismo. Genera una rutina semanal COMPLETA de 7 días (Monday a Sunday) en formato JSON.

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

REGLAS ESTRICTAS:
1. weekStart DEBE ser exactamente: "${nextMonday}"
2. SIEMPRE incluir los 7 días de la semana (Monday a Sunday)
3. Distribuir ${daysPerWeek} días de tipo "Gym" y ${cyclingDays || 0} días de tipo "Cycling". Los demás son "Rest". Si un día tiene gym Y ciclismo, usar tipo "Gym + Cycling".
4. Para días Gym: incluir entre 5-8 ejercicios con nombre en ESPAÑOL, targetSets (3-5), y targetReps como rango (ej: "8-10", "12-15")
5. Para días Cycling: incluir targetDuration (60-120 minutos) y targetPower (zona como "Z2 Endurance", "Z3 Tempo", "Z4 Threshold")
6. Para días Rest: NO incluir exercises, targetDuration ni targetPower
7. Variar los grupos musculares entre días de gym (no repetir el mismo grupo dos días seguidos)
8. Los ejercicios deben ser realistas y progresivos para el objetivo "${goal}"

Responde UNICAMENTE con el JSON, sin texto adicional ni markdown. El formato exacto es:
{
  "weekStart": "${nextMonday}",
  "days": [
    {
      "dayOfWeek": "Monday",
      "type": "Gym",
      "exercises": [{ "name": "Sentadillas", "targetSets": 4, "targetReps": "8-10" }]
    },
    {
      "dayOfWeek": "Tuesday",
      "type": "Cycling",
      "targetDuration": 90,
      "targetPower": "Z2 Endurance"
    },
    {
      "dayOfWeek": "Wednesday",
      "type": "Rest"
    }
  ]
}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Claude no devolvió una respuesta válida' }, { status: 502 });
    }

    const routine = JSON.parse(textBlock.text);
    routine.weekStart = nextMonday;

    return NextResponse.json(routine);
  } catch (err: any) {
    console.error('Claude generation error:', err);
    return NextResponse.json(
      { error: 'Error al generar la rutina', details: err.message },
      { status: 500 }
    );
  }
}
