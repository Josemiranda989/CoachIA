import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GoogleGenAI, Type } from '@google/genai';
import { getValidAccessToken, fetchActivities, fetchStats } from '@/lib/strava';
import { hrZonesSummary } from '@/lib/hr-zones';

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
          targetDuration: { type: Type.NUMBER, description: 'Total minutes for cycling days (sum of all blocks)' },
          targetPower: { type: Type.STRING, description: 'Summary label, e.g. "Z2" or "Z2 + 4xZ4"' },
          blocks: {
            type: Type.ARRAY,
            description: 'Only for Cycling days. Ordered ride blocks: warmup -> steady|interval (x N) -> cooldown.',
            items: {
              type: Type.OBJECT,
              properties: {
                kind: { type: Type.STRING, description: "'warmup' | 'steady' | 'interval' | 'cooldown'" },
                duration: { type: Type.NUMBER, description: "Minutes. For kind='interval' this is the duration of EACH rep." },
                targetPower: { type: Type.STRING },
                repetitions: { type: Type.NUMBER, description: "Only for kind='interval'." },
                recoveryDuration: { type: Type.NUMBER, description: "Only for kind='interval'. Recovery minutes between reps." },
                recoveryPower: { type: Type.STRING, description: "Only for kind='interval'. Usually Z1 or Z2." },
                targetCadence: { type: Type.STRING, description: "Optional cadence target. Examples: '85-95 rpm' (default Z2), '100+ rpm spin-up', '60-65 rpm big gear' (low-cadence strength)." },
                notes: { type: Type.STRING },
              },
              required: ['kind', 'duration', 'targetPower'],
            },
          },
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
  const y = nextMonday.getFullYear();
  const m = String(nextMonday.getMonth() + 1).padStart(2, "0");
  const d = String(nextMonday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function gatherAthleteData(userId: string) {
  // HR zones — only kick in when rider has filled them in /profile.
  const hrUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcMax: true, lthr: true },
  });
  const hrSection = hrUser ? hrZonesSummary({ fcMax: hrUser.fcMax, lthr: hrUser.lthr }) : null;

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
            if (ride.average_cadence) line += `, ${Math.round(ride.average_cadence)} rpm`;
            stravaSection += `\n${line}`;
          }
        }
      }
    }
  } catch {
    // Strava not available — continue without it
  }

  return { gymSection, stravaSection, hrSection };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    let userId: string | null = null;

    if (session?.user?.id) {
      userId = session.user.id as string;
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
    const { gymSection, stravaSection, hrSection } = await gatherAthleteData(userId);

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
${hrSection ? `\n${hrSection}` : ''}

USA LOS DATOS REALES del atleta para:
- Ajustar los pesos y repeticiones de gym basándote en sus PRs (no pongas pesos genéricos, usá porcentajes realistas de sus récords)
- Ajustar la duración e intensidad del ciclismo según su nivel real (distancias, velocidad promedio, FC y potencia recientes)
- Si no hay datos de ciclismo, usá valores conservadores para principiante
- Si conocés las zonas FC del atleta (sección "Zonas FC"), podés anotar el rango bpm en notes para que el atleta tenga referencia explícita en pantalla. Ej: notes "Z4 sostenible (~150-158 bpm)"

PERIODIZACIÓN SEMANAL (OBLIGATORIA):

Distribución preferida del atleta cuando hay 3 gym + 3 cycling + 1 rest (Opción A, fija):
- Monday: Gym (empuje/jalón, SIN piernas)
- Tuesday: Cycling — INTERVAL day (piernas frescas)
- Wednesday: Gym — LEG DAY (sentadilla, prensa, peso muerto, zancadas, hip thrust)
- Thursday: Cycling Z2 volumen
- Friday: Gym (empuje/jalón, SIN piernas)
- Saturday: Cycling — LONG RIDE suave (Z1-Z2)
- Sunday: Rest

Si daysPerWeek ≠ 3 o cyclingDays ≠ 3, adaptá manteniendo las REGLAS FISIOLÓGICAS abajo.

REGLAS FISIOLÓGICAS (OBLIGATORIAS, no negociables):
A. Saturday es el ride MÁS LARGO de la semana (90-180min) PERO SIEMPRE en intensidad SUAVE (Z1-Z2). NUNCA meter intervals, Z4 ni Z5 el sábado. Notes del sábado: énfasis en mantener Z2 bajo y NO acelerar al final.
A2. La intensidad del cycling vive en UNA sola sesión INTERVAL entre semana, preferentemente Tuesday. Regla dura: **1 solo día de calidad de cycling por semana**. Los otros cycling days son Z2/Z1 volumen o recovery.
B. Las piernas pesadas en gym (sentadilla, prensa, peso muerto, zancadas, hip thrust) deben respetar **72hs mínimo antes del sábado**. Ventana válida: Monday, Tuesday, Wednesday. NUNCA Thursday/Friday/Saturday.
C. El día siguiente a leg day debe ser "Rest" o "Cycling" Z1-Z2 volumen/recovery (≤90min). NUNCA intensidad alta ni piernas otra vez.
D. El interval day de cycling SIEMPRE con piernas frescas. Si leg day cae el mismo día o el anterior al interval day → mover leg day.
E. Sunday → Rest post-sábado largo. Rest absoluto, no "cycling Z1 muy suave".
F. Gym upper (empuje/jalón) se distribuye en los días no-leg y no-interval — típicamente Monday y Friday.
G. Viernes: si hay gym upper, OK. Si no hay gym ese día, puede ser cycling suave o Rest — NUNCA cycling INTERVAL ni leg day.

ESTILO DEL ATLETA (preferencias extraídas de un plan real que le funcionó):
- Vocabulario de intensidad por RPE — úsalo en el campo "notes":
  - "suave" = Z1-Z2 bajo, conversación fluida
  - "ligero" = Z2 cómodo
  - "medio exigido" = Z3 tempo
  - "fuerte sostenible" = Z4 umbral (clave: **SOSTENIBLE** = podés mantenerlo toda la rep, NO es all-out)
  - "fuerte" / "máximo" = Z5+ (raro)
- Concepto ancla "SOSTENIBLE": el atleta puede MANTENER el esfuerzo todos los minutos que dura la rep. Si la última rep tiene que bajar de ritmo → se pasó. Usá esta palabra siempre que prescribas Z3-Z4.
- Ratios recovery/trabajo en intervals (REGLA DURA):
  - **Default: 1:1** — recovery dura IGUAL que la rep. Aplica a reps de 2', 3', 4', 5'. Ej: 4x4' → recovery 4'.
  - **Excepción: 2:1 SOLO cuando la rep dura ≥10 minutos**. Ej: 2x10' → recovery 5'.
  - NO inventar ratios distintos. Si el bloque no encaja en 1:1 o 2:1 → repensalo.

ZONAS DE POTENCIA (Coggan 7-zone model, %FTP):
- Z1 Recovery activo: <55% FTP — rides post-piernas, very easy
- Z2 Endurance: 56-75% FTP — base, la mayoría del volumen semanal
- Z3 Tempo: 76-90% FTP — ritmo "confortable rápido", conversación entrecortada
- Z4 Threshold: 91-105% FTP — umbral, sostenible 30-60min máximo (en intervals: 4-15min por rep)
- Z5 VO2max: 106-120% FTP — máximo aeróbico, sostenible 3-8min total (en intervals: 2-5min por rep)
- Z6+ Anaeróbico: >120% — sprints/all-out, sostenible 30s-2min

DURACIONES DE REP POR ZONA (fisiológicamente realistas — NO VIOLAR):
- Z3 Tempo: 8-20min por rep, recovery 1:1 (default) o 2:1 si rep ≥10min
- Z4 Threshold/SOSTENIBLE: 4-15min por rep, recovery 1:1 default
- Z5 VO2max: 2-5min por rep, NUNCA exceder 5min/rep, recovery 1:1 (rara excepción 2:1)
- Z6+ Anaeróbico: 30s-2min por rep, raro

REGLA DURA — kind="steady" SOLO permitido en Z1, Z2 o Z3.
- Z4 SIEMPRE como kind="interval" con mínimo 2 reps.
- Z5 SIEMPRE como kind="interval" con mínimo 3 reps.
- Un bloque steady de 6min en Z4 o Z5 NO es un entreno, es un test mal pegado. PROHIBIDO.

CADENCIA (campo opcional targetCadence por bloque):
- Default Z2/Z3 self-paced (~85-95 rpm aspiracional). Cadencia auto-seleccionada actual del atleta: 80-90 rpm; subir arriba de 90 le resulta neuromuscularmente exigido (no cardio). Omitir targetCadence en bloques normales.
- **Spin-up drills** (cadencia pura, foco neuromuscular): kind="interval" con targetPower "Z1" o "Z2" (watts bajos — el desafío es MOTOR, no aerobio), duration 1-2min, repetitions 4-6, recoveryDuration 2-3min en "Z1", targetCadence "90-95 rpm" (progresar a "95-100 rpm" tras 2-3 semanas de drills consistentes). Schedular en el warmup de la long ride, NO en el día de intervals duros. Notes: vocabulario MOTOR ("pedaleo redondo", "no rebotar", "círculo"), NO mencionar potencia ni FC — distrae del foco.
- **Big gear / fuerza-resistencia** (reclutamiento de fibra): intervals Z3-Z4 con targetCadence "50-65 rpm big gear". Tip: meter "fuerza-resistencia" como tipo de sesión alternativo al VO2max si el objetivo incluye fuerza pedalística.
- Recovery rides post-piernas: targetCadence "90+ rpm" para no cargar piernas.
- Solo prescribir cadencia cuando aporte (no llenar bloques con el default redundante).

REGLAS ESTRICTAS:
1. weekStart DEBE ser exactamente: "${nextMonday}"
2. SIEMPRE incluir los 7 días de la semana (Monday a Sunday)
3. Distribuir ${daysPerWeek} días de tipo "Gym" y ${cyclingDays || 0} días de tipo "Cycling". Los demás son "Rest". Si un día tiene gym Y ciclismo, usar tipo "Gym + Cycling".
4. Para días Gym: incluir entre 5-8 ejercicios con nombre en ESPAÑOL, targetSets (3-5), y targetReps como rango (ej: "8-10", "12-15")
5. Para días Cycling: incluir targetDuration (total minutos, 60-120), targetPower (label resumen "Z2" o "Z2 + 4xZ4"), y **blocks** (array ordenado de la ride):
   - warmup (10-20min Z1-Z2) → steady|interval (×N) → cooldown (8-15min Z1). Entre 3 y 7 bloques.
   - kind="interval" usa formato COMPRIMIDO: duration=duración DE CADA rep, repetitions=cantidad, recoveryDuration=min entre reps, recoveryPower=zona recovery. Ej "4x4min Z4/3min Z2" → {kind:"interval",duration:4,targetPower:"Z4",repetitions:4,recoveryDuration:3,recoveryPower:"Z2"}.
   - kind="steady" = bloque sostenido (duration, targetPower). NO usar repetitions. SOLO en Z1-Z3.
   - La suma (warmup + Σ rep*(duration+recoveryDuration) + Σ steady.duration + cooldown) debe igualar targetDuration.
   - Rides recovery (post-piernas): solo warmup + steady Z1-Z2 + cooldown, sin interval, targetCadence "90+ rpm".
6. Para días Rest: NO incluir exercises, targetDuration, targetPower ni blocks
7. Variar los grupos musculares entre días de gym (no repetir el mismo grupo dos días seguidos)
8. Los ejercicios deben ser realistas y progresivos para el objetivo "${goal}"

EJEMPLOS DE BLOCKS BIEN FORMADOS:

Recovery ride post-piernas (60min, Z2):
[
  {"kind":"warmup","duration":10,"targetPower":"Z1","targetCadence":"90+ rpm"},
  {"kind":"steady","duration":40,"targetPower":"Z2","targetCadence":"90+ rpm","notes":"Piernas ligeras, NO subir pulsaciones"},
  {"kind":"cooldown","duration":10,"targetPower":"Z1"}
]

VO2max (60min total, 4x4 Z5):
[
  {"kind":"warmup","duration":15,"targetPower":"Z1-Z2"},
  {"kind":"interval","duration":4,"targetPower":"Z5","repetitions":4,"recoveryDuration":4,"recoveryPower":"Z1","notes":"Primer rep suave, últimos 2 sostener"},
  {"kind":"cooldown","duration":13,"targetPower":"Z1"}
]

Fuerza-resistencia big gear (75min):
[
  {"kind":"warmup","duration":15,"targetPower":"Z1-Z2"},
  {"kind":"interval","duration":6,"targetPower":"Z3","repetitions":4,"recoveryDuration":4,"recoveryPower":"Z2","targetCadence":"55-65 rpm","notes":"Plato grande, sentado, traccionar con cuádriceps. SOSTENIBLE."},
  {"kind":"cooldown","duration":16,"targetPower":"Z1"}
]

Long ride sábado (120min Z2):
[
  {"kind":"warmup","duration":15,"targetPower":"Z1"},
  {"kind":"steady","duration":90,"targetPower":"Z2","notes":"Z2 bajo, conversación fluida, NO acelerar al final"},
  {"kind":"cooldown","duration":15,"targetPower":"Z1"}
]`;

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
